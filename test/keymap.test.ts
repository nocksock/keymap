import { describe, it, expect, vi  } from "vitest";
import { Keymap } from "../src/keymap"
import { parseInput } from "../src/keys";
import { StackMap } from "../src/stackmap";

describe("new Keymap", () => {
    it("can take nothing", () => {
        const keymap = new Keymap()
    })
    it("can take object", () => {
        const action = () => {}
        const keymap = new Keymap({
            'a': action
        })
        expect(keymap.get('a')).toEqual(action)
    })
    it('raises on invalid args', () => {
        expect(() => {
            new Keymap({
                // @ts-expect-error
                'a': 123
            })
        }).toThrow()
    })
})

describe('keymap.type', () => {
    it("calls function when matching", () => {
        const fna = vi.fn()
        const fnb = vi.fn()
        const km = new Keymap({
            'a': fna,
            'ctrl+b': fnb
        })

        km.type('b')
        expect(fna).not.toHaveBeenCalled()

        km.type('a')
        expect(fna).toHaveBeenCalledOnce()

        km.type('a')
        expect(fna).toHaveBeenCalledTimes(2)

        km.type(parseInput('ctrl+b'))
        expect(fnb).toHaveBeenCalledTimes(1)
    })
})

describe('keymap.load', () => {
    it("replaces the existing bindings", () => {
        const oldFn = vi.fn()
        const newFn = {effect: vi.fn()}
        const km = new Keymap({ 'a': oldFn })

        km.load({ 'b': newFn })

        // old binding is gone...
        expect(km.get('a')).toBeUndefined()
        km.type('a')
        expect(oldFn).not.toHaveBeenCalled()

        // ...and the new one is active
        expect(km.get('b')).toEqual(newFn)
        km.type('b')
        expect(newFn.effect).toHaveBeenCalledOnce()
    })

    it("resets the multi-key buffer", () => {
        const gg = vi.fn()
        // two entries share the 'g' prefix, so a single 'g' is ambiguous and is buffered
        const km = new Keymap({ 'g g': gg, 'g l': () => {} })

        km.type('g') // half-typed: buffer is now ['g'], waiting for disambiguation

        km.load({ 'g g': gg, 'g l': () => {} }) // must clear that stale buffer

        // if the buffer had survived, this 'g' would complete 'g g' and fire immediately
        km.type('g')
        expect(gg).not.toHaveBeenCalled()

        // a fresh, full sequence still works
        km.type('g')
        expect(gg).toHaveBeenCalledOnce()
    })

    it("is chainable", () => {
        const km = new Keymap()
        expect(km.load({ 'a': () => {} })).toBe(km)
    })
})

describe('keymap.type — result', () => {
    it("returns 'handled' when a binding matches and fires", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'a': fn })

        expect(km.type('a')).toBe('handled')
        expect(fn).toHaveBeenCalledOnce()
    })

    it("returns 'unhandled' when nothing matches", () => {
        const km = new Keymap({ 'a': () => {} })

        expect(km.type('x')).toBe('unhandled')
    })

    it("returns 'pending' midway through a multi-key sequence, then 'handled'", () => {
        const gg = vi.fn()
        // 'g e' shares the prefix, so a single 'g' is genuinely ambiguous
        const km = new Keymap({ 'g g': gg, 'g e': () => {} })

        expect(km.type('g')).toBe('pending')
        expect(gg).not.toHaveBeenCalled()

        expect(km.type('g')).toBe('handled')
        expect(gg).toHaveBeenCalledOnce()
    })

    it("returns 'unhandled' and resets when a pending sequence is broken", () => {
        const km = new Keymap({ 'g g': () => {}, 'g e': () => {} })

        expect(km.type('g')).toBe('pending')
        expect(km.type('x')).toBe('unhandled') // 'g x' matches nothing
    })

    // operator-pending: a prefix of a longer binding must WAIT, never auto-fire,
    // even when it is the only candidate. This is the hook for `d` + motion.
    it("treats a lone multi-key prefix as 'pending', not an early fire", () => {
        const dw = vi.fn()
        const km = new Keymap({ 'd w': dw })

        expect(km.type('d')).toBe('pending')
        expect(dw).not.toHaveBeenCalled()

        expect(km.type('w')).toBe('handled')
        expect(dw).toHaveBeenCalledOnce()
    })
})

describe('keymap.stack (push / pop)', () => {
    it("a pushed layer shadows a base binding for the same key", () => {
        const base = vi.fn()
        const top = vi.fn()
        const km = new Keymap({ 'j': base })

        km.push({ 'j': top })
        km.type('j')

        expect(base).not.toHaveBeenCalled()
        expect(top).toHaveBeenCalledOnce()
    })

    it("falls through to the base for keys absent from the top layer", () => {
        const j = vi.fn()
        const k = vi.fn()
        const km = new Keymap({ 'j': j, 'k': k })

        km.push({ 'j': () => {} }) // top overrides only 'j'
        km.type('k')

        expect(k).toHaveBeenCalledOnce() // 'k' fell through to the base
    })

    it("pop() removes the top layer and restores the base", () => {
        const base = vi.fn()
        const top = vi.fn()
        const km = new Keymap({ 'j': base })

        km.push({ 'j': top })
        km.pop()
        km.type('j')

        expect(base).toHaveBeenCalledOnce()
        expect(top).not.toHaveBeenCalled()
    })

    it("stacks and pops layers in LIFO order", () => {
        const base = vi.fn()
        const a = vi.fn()
        const b = vi.fn()
        const km = new Keymap({ 'j': base })

        km.push({ 'j': a })
        km.push({ 'j': b })

        km.type('j')
        expect(b).toHaveBeenCalledOnce() // topmost wins

        km.pop()
        km.type('j')
        expect(a).toHaveBeenCalledOnce() // next layer down

        km.pop()
        km.type('j')
        expect(base).toHaveBeenCalledOnce() // back to base
    })

    it("resolves a multi-key sequence within a pushed layer", () => {
        const gg = vi.fn()
        const km = new Keymap()

        km.push({ 'g g': gg, 'g e': () => {} }) // 'g e' keeps 'g' ambiguous
        km.type('g')
        km.type('g')

        expect(gg).toHaveBeenCalledOnce()
    })

    it("falls through to a base sequence when the top layer doesn't define it", () => {
        const gg = vi.fn()
        const km = new Keymap({ 'g g': gg })

        km.push({ 'x': () => {} }) // unrelated top layer
        km.type('g')
        km.type('g')

        expect(gg).toHaveBeenCalledOnce() // base sequence still reachable
    })

    it("pop() on an empty stack is a no-op (never removes the base)", () => {
        const base = vi.fn()
        const km = new Keymap({ 'j': base })

        km.pop() // nothing pushed
        km.type('j')

        expect(base).toHaveBeenCalledOnce()
    })

    it("push is chainable", () => {
        const km = new Keymap()
        expect(km.push({ 'a': () => {} })).toBe(km)
    })
})

describe('object binding config ({ group, description, effect })', () => {
    it("fires the effect of an object-form binding", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'a': { group: 'nav', description: 'do a', effect: fn } })

        expect(km.type('a')).toBe('handled')
        expect(fn).toHaveBeenCalledOnce()
    })

    it("retains group and description on the stored binding", () => {
        const km = new Keymap({ 'a': { group: 'nav', description: 'do a', effect: () => {} } })

        expect(km.get('a')).toMatchObject({ group: 'nav', description: 'do a' })
    })

    it("passes ctx to an object-form effect, like a plain function", () => {
        const fn = vi.fn()
        const ctx = { who: 'me' }
        const km = new Keymap({ 'a': { effect: fn } })

        km.type('a', ctx)

        expect(fn).toHaveBeenCalledWith(expect.objectContaining({context: ctx}))
    })

    it("mixes object-form and function-form bindings in one map", () => {
        const obj = vi.fn()
        const plain = vi.fn()
        const km = new Keymap({ 'a': { effect: obj }, 'b': plain })

        km.type('a')
        km.type('b')

        expect(obj).toHaveBeenCalledOnce()
        expect(plain).toHaveBeenCalledOnce()
    })
})

describe('keymap.stack — cross-layer shared prefix', () => {
    // Rule: the TOPMOST layer that has any candidate (complete OR prefix) for the
    // current buffer owns the resolution; lower layers cannot extend or complete a
    // buffer the top already claims. This stays decidable without a timeout and keeps
    // the complete-vs-prefix ambiguity from ever spanning layers.

    it("a top single-key binding shadows a base sequence that shares its prefix", () => {
        const gg = vi.fn()
        const g = vi.fn()
        const km = new Keymap({ 'g g': gg })

        km.push({ 'g': g }) // top claims 'g' as a complete binding

        expect(km.type('g')).toBe('handled')
        expect(g).toHaveBeenCalledOnce()
        expect(gg).not.toHaveBeenCalled() // base 'g g' is unreachable while top is active

        // a repeat fires the top 'g' again — it never builds toward the base 'g g'
        expect(km.type('g')).toBe('handled')
        expect(g).toHaveBeenCalledTimes(2)
        expect(gg).not.toHaveBeenCalled()
    })

    it("restores the base sequence after the shadowing layer is popped", () => {
        const gg = vi.fn()
        const g = vi.fn()
        const km = new Keymap({ 'g g': gg })

        km.push({ 'g': g })
        km.pop()

        km.type('g')
        km.type('g')

        expect(gg).toHaveBeenCalledOnce() // 'g g' reachable again
        expect(g).not.toHaveBeenCalled()
    })

    it("a top sequence shadows a base single-key that shares its prefix", () => {
        const g = vi.fn()
        const gg = vi.fn()
        const km = new Keymap({ 'g': g })

        km.push({ 'g g': gg }) // top claims the 'g' prefix via 'g g'

        // top owns the 'g' prefix, so the first 'g' waits instead of firing base 'g'
        expect(km.type('g')).toBe('pending')
        expect(g).not.toHaveBeenCalled()

        expect(km.type('g')).toBe('handled')
        expect(gg).toHaveBeenCalledOnce()
        expect(g).not.toHaveBeenCalled() // base 'g' stays shadowed
    })
})

describe('edge cases', () => {
    // build a KeyboardEvent-shaped object for the non-string type() path
    const evt = (key: string, mods: Partial<Record<'ctrlKey'|'altKey'|'shiftKey'|'metaKey', boolean>> = {}) =>
        ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods }) as any

    it("resolves a 3-key sequence and disambiguates at depth", () => {
        const ab = vi.fn()
        const km = new Keymap({ 'g a b': ab, 'g a c': () => {} })

        km.type('g'); km.type('a'); km.type('b')

        expect(ab).toHaveBeenCalledOnce()
    })

    it("recovers after a broken sequence", () => {
        const gg = vi.fn()
        const km = new Keymap({ 'g g': gg, 'g e': () => {} })

        km.type('g'); km.type('x') // broken → should reset
        km.type('g'); km.type('g') // clean run

        expect(gg).toHaveBeenCalledOnce()
    })

    it("overwriting a key with set replaces the binding", () => {
        const a = vi.fn(), b = vi.fn()
        const km = new Keymap({ 'x': a })

        km.set('x', b)
        km.type('x')

        expect(b).toHaveBeenCalledOnce()
        expect(a).not.toHaveBeenCalled()
    })

    it("over-popping past the base does not corrupt the stack", () => {
        const base = vi.fn(), top = vi.fn()
        const km = new Keymap({ 'j': base })

        km.push({ 'j': top })
        km.pop(); km.pop(); km.pop() // over-pop
        km.push({ 'j': top })        // push still works
        km.type('j')

        expect(top).toHaveBeenCalledOnce()
    })

    it("a single map with both a key and a longer sequence waits on the prefix", () => {
        // same complete-vs-prefix question, inside ONE map (not across layers)
        const g = vi.fn(), gg = vi.fn()
        const km = new Keymap({ 'g': g, 'g g': gg })

        expect(km.type('g')).toBe('pending') // must not fire the short 'g' early
        expect(g).not.toHaveBeenCalled()

        expect(km.type('g')).toBe('handled')
        expect(gg).toHaveBeenCalledOnce()
    })

    it("an effect that pushes a layer takes effect for the next key (mode switch)", () => {
        const inserted = vi.fn()
        const km = new Keymap({ 'i': () => km.push({ 'x': inserted }) })

        km.type('i') // enters 'insert' by pushing a layer
        km.type('x')

        expect(inserted).toHaveBeenCalledOnce()
    })

    it("load() while a layer is pushed gives a clean base (stack cleared)", () => {
        const top = vi.fn(), newBase = vi.fn()
        const km = new Keymap({ 'j': () => {} })

        km.push({ 'j': top })
        km.load({ 'j': newBase })
        km.type('j')

        expect(newBase).toHaveBeenCalledOnce()
        expect(top).not.toHaveBeenCalled()
    })

    it("a re-entrant effect (calls type itself) does not corrupt the buffer", () => {
        const inner = vi.fn()
        const km = new Keymap({ 'a': () => km.type('b'), 'b': inner })

        km.type('a')

        expect(inner).toHaveBeenCalledOnce()
    })

    it("matches an Escape KeyboardEvent against an 'escape' binding", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'escape': fn })

        km.type(evt('Escape'))

        expect(fn).toHaveBeenCalledOnce()
    })

    it("matches a space KeyboardEvent against a 'space' binding", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'space': fn })

        km.type(evt(' '))

        expect(fn).toHaveBeenCalledOnce()
    })

    it("matches a Shift+H KeyboardEvent against a 'shift+h' binding", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'shift+h': fn }) // canonical lowercase registration

        km.type(evt('H', { shiftKey: true }))

        expect(fn).toHaveBeenCalledOnce()
    })

    it("ignores a lone modifier keydown mid-sequence", () => {
        const gg = vi.fn()
        const km = new Keymap({ 'g g': gg })

        km.handleKeyboardEvent(evt('g'))
        km.handleKeyboardEvent(evt('Shift', { shiftKey: true })) // lone modifier — must not pollute the buffer
        km.handleKeyboardEvent(evt('g'))

        expect(gg).toHaveBeenCalledOnce()
    })

    it("preventDefault is called for a matched key but not an unmatched one", () => {
        const km = new Keymap({ 'a': () => {} })

        const matched = evt('a'); matched.preventDefault = vi.fn()
        km.handleKeyboardEvent(matched)
        expect(matched.preventDefault).toHaveBeenCalled()

        const missed = evt('z'); missed.preventDefault = vi.fn()
        km.handleKeyboardEvent(missed)
        expect(missed.preventDefault).not.toHaveBeenCalled()
    })
})

describe.sequential('keymap.list (introspection)', () => {
    it("lists each binding with its keys, group and description", () => {
        const km = new Keymap({
            'j': { group: 'nav', description: 'down', effect: () => {} },
            'k': { group: 'nav', description: 'up', effect: () => {} },
        })

        expect(km.list()).toEqual(expect.arrayContaining([
            expect.objectContaining({ keys: 'j', group: 'nav', description: 'down' }),
            expect.objectContaining({ keys: 'k', group: 'nav', description: 'up' }),
        ]))
    })

    it("includes function-form bindings (no metadata)", () => {
        const km = new Keymap({ 'a': () => {} })

        expect(km.list()).toEqual([expect.objectContaining({ keys: 'a' })])
    })

    it("is stack-aware: a pushed layer shadows the base for the same key (no duplicate)", () => {
        const km = new Keymap({ 'j': { group: 'base', description: 'b', effect: () => {} } })
        km.push({ 'j': { group: 'layer', description: 'l', effect: () => {} } })

        const j = km.list().filter((e) => e.keys === 'j')
        expect(j).toHaveLength(1) // shadowed, not listed twice
        expect(j[0]).toMatchObject({ group: 'layer', description: 'l' })
    })

    it("returns the base metadata again after the layer is popped", () => {
        const km = new Keymap({ 'j': { group: 'base', description: 'b', effect: () => {} } })
        km.push({ 'j': { group: 'layer', description: 'l', effect: () => {} } })
        km.pop()

        expect(km.list().find((e) => e.keys === 'j')).toMatchObject({ group: 'base' })
    })
})

describe('preventDefault opt-out', () => {
    const evt = (key: string, mods: Partial<Record<'ctrlKey'|'altKey'|'shiftKey'|'metaKey', boolean>> = {}) =>
        ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault: vi.fn(), ...mods }) as any

    it("suppresses the default for a matched key by default", () => {
        const km = new Keymap({ 'a': () => {} })
        const e = evt('a')

        km.handleKeyboardEvent(e)

        expect(e.preventDefault).toHaveBeenCalled() // baseline: prevents by default
    })

    it("a binding with preventDefault:false lets the default through", () => {
        const km = new Keymap({ 'a': { preventDefault: false, effect: () => {} } })
        const e = evt('a')

        km.handleKeyboardEvent(e)

        expect(e.preventDefault).not.toHaveBeenCalled()
    })

    it("ctx.permitDefault() opts out at runtime for this press", () => {
        const km = new Keymap({ 'a': (ctx: any) => ctx.permitDefault() })
        const e = evt('a')

        km.handleKeyboardEvent(e)

        expect(e.preventDefault).not.toHaveBeenCalled()
    })

    it("permitDefault is per-press, not sticky", () => {
        const km = new Keymap({ 'a': (ctx: any) => { if (ctx.once) ctx.permitDefault() } })

        km.handleKeyboardEvent({ ...evt('a'), once: true })
        const next = evt('a')
        km.handleKeyboardEvent(next)

        expect(next.preventDefault).toHaveBeenCalled() // a later press still prevents
    })
})

describe('keymap.reset / blur', () => {
    it("reset() cancels a pending sequence buffer", () => {
        const gg = vi.fn()
        const km = new Keymap({ 'g g': gg, 'g e': () => {} })

        km.type('g') // pending
        km.reset()

        km.type('g') // buffer was cleared, so this is a fresh first 'g' (pending again)
        expect(gg).not.toHaveBeenCalled()

        km.type('g') // completes a clean 'g g'
        expect(gg).toHaveBeenCalledOnce()
    })

    it("reset() clears the buffer but keeps pushed layers", () => {
        const top = vi.fn()
        const km = new Keymap({ 'a': () => {} })

        km.push({ 'j': top })
        km.reset()
        km.type('j')

        expect(top).toHaveBeenCalledOnce() // layer still active after reset
    })

    it("reset is safe to wire directly as a blur listener (detached, no event needed)", () => {
        const gg = vi.fn()
        const km = new Keymap({ 'g g': gg, 'g e': () => {} })

        km.type('g') // pending
        const reset = km.reset // as in addEventListener('blur', km.reset)
        expect(() => reset()).not.toThrow()

        km.type('g')
        expect(gg).not.toHaveBeenCalled() // buffer was cleared by the detached call
    })
})

describe('keymap.stack — exclusive (non-shadowing) push', () => {
    it("an exclusive layer hides the base entirely (no fall-through)", () => {
        const j = vi.fn()
        const x = vi.fn()
        const km = new Keymap({ 'j': j, 'k': () => {} })

        km.push({ 'x': x }, { exclusive: true })

        // base keys are NOT reachable while an exclusive layer is active
        expect(km.type('j')).toBe('unhandled')
        expect(j).not.toHaveBeenCalled()

        // only the pushed layer resolves
        km.type('x')
        expect(x).toHaveBeenCalledOnce()
    })

    it("pop() restores the base after an exclusive push", () => {
        const j = vi.fn()
        const km = new Keymap({ 'j': j })

        km.push({ 'x': () => {} }, { exclusive: true })
        km.pop()

        km.type('j')
        expect(j).toHaveBeenCalledOnce() // base reachable (and merging) again
    })

    it("default push still shadows with fall-through (contrast)", () => {
        const j = vi.fn()
        const km = new Keymap({ 'j': j, 'k': () => {} })

        km.push({ 'x': () => {} }) // no option → shadow + fall-through

        km.type('j')
        expect(j).toHaveBeenCalledOnce() // base 'j' still falls through
    })

    it("list() reflects only the exclusive layer", () => {
        const km = new Keymap({ 'j': { group: 'base', description: 'down', effect: () => {} } })

        km.push({ 'x': { group: 'modal', description: 'go', effect: () => {} } }, { exclusive: true })

        expect(km.list().map((e) => e.keys)).toEqual(['x']) // base 'j' is hidden
    })

    it("stacks LIFO with a shadow layer below an exclusive one", () => {
        const baseM = vi.fn()
        const km = new Keymap({ 'm': baseM })

        km.push({ 'j': () => {} })                    // shadow layer (m still falls through)
        km.push({ 'x': () => {} }, { exclusive: true }) // exclusive on top hides everything else

        expect(km.type('m')).toBe('unhandled') // base 'm' hidden by the exclusive layer
        expect(baseM).not.toHaveBeenCalled()

        km.pop() // drop the exclusive layer → back to the shadow layer over base
        km.type('m')
        expect(baseM).toHaveBeenCalledOnce() // 'm' falls through again
    })
})

describe('performance & memory', () => {
    it("balanced push/pop churn fully restores the base (no stack accumulation)", () => {
        const base = vi.fn()
        const km = new Keymap({ 'j': base })

        for (let i = 0; i < 5_000; i++) {
            km.push({ 'j': () => {} })
            km.pop()
        }

        km.type('j')
        expect(base).toHaveBeenCalledOnce() // every pop restored the prior map exactly
    })

    it("keeps the key buffer bounded under sustained unmatched input", () => {
        const hit = vi.fn()
        const km = new Keymap({ 'a b': hit })

        // hammer with input that never matches — each keystroke must reset the buffer,
        // so it can never grow without bound
        for (let i = 0; i < 100_000; i++) km.type('z')

        // a clean sequence still resolves => the buffer was never left in a bad/huge state
        km.type('a'); km.type('b')
        expect(hit).toHaveBeenCalledOnce()
    })

    it("stays within a generous budget for a large map + many keystrokes (catastrophic-regression guard)", () => {
        const map: Record<string, () => void> = {}
        for (let i = 0; i < 2_000; i++) map['k' + i] = () => {}
        const km = new Keymap(map)

        const start = performance.now()
        for (let i = 0; i < 10_000; i++) km.type('k' + (i % 2_000))
        const ms = performance.now() - start

        // coarse guard: linear-ish work finishes in well under this; quadratic blows past it
        expect(ms).toBeLessThan(2_000)
    })

    // Requires --expose-gc (e.g. run vitest with NODE_OPTIONS=--expose-gc); skipped otherwise.
    it.skipIf(!(globalThis as any).gc)("releases a popped layer for garbage collection", async () => {
        const km = new Keymap({ 'a': () => {} })

        // create the layer in an isolated scope so the ONLY strong reference to `sentinel`
        // is the effect closure held by the pushed layer
        const ref = (() => {
            const sentinel = {}
            km.push({ 'b': () => { void sentinel } })
            return new WeakRef(sentinel)
        })()

        km.pop() // dropping the layer should free the closure → the sentinel

        ;(globalThis as any).gc()
        await new Promise((r) => setTimeout(r, 0))
        ;(globalThis as any).gc()

        expect(ref.deref()).toBeUndefined()
    })

    // Makes the StackMap proxy's per-access .bind() allocation visible & deterministic.
    // The proxy rebinds a fresh function on every property access, so each hot-path
    // `map.entries()` in filterByPrefix allocates. Stable identity = the fix (cache/​no-bind).
    it("StackMap returns a stable method reference (no per-access bind allocation)", () => {
        const sm = new StackMap<() => void>()

        expect(sm.entries).toBe(sm.entries) // a fresh bound fn per access would fail this
        expect(sm.get).toBe(sm.get)
    })

    // Same allocation surfaced through the public hot path: type() reaches the proxy via
    // filterByPrefix(this.#map, ...) -> map.entries().
    it("the resolution map exposes a stable entries reference", () => {
        const km = new Keymap({ 'a': () => {} })
        const map = km.current()

        expect(map.entries).toBe(map.entries)
    })
})

describe('load() vs the layer stack', () => {
    it("load() clears the stack — a later pop() does not resurrect a layer", () => {
        const top = vi.fn()
        const newBase = vi.fn()
        const km = new Keymap({ 'j': () => {} })

        km.push({ 'j': top })
        km.load({ 'j': newBase }) // fresh slate: base replaced AND stack cleared
        km.pop()                  // nothing should remain to pop back to

        km.type('j')
        expect(newBase).toHaveBeenCalledOnce() // still the loaded base...
        expect(top).not.toHaveBeenCalled()     // ...not a resurrected pre-load layer
    })
})

describe('modifier canonicalization', () => {
    const evt = (key: string, mods: Partial<Record<'ctrlKey'|'altKey'|'shiftKey'|'metaKey', boolean>> = {}) =>
        ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault: () => {}, ...mods }) as any

    it("matches regardless of modifier order (shift+ctrl+a -> Ctrl+Shift+A)", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'shift+ctrl+a': fn })

        km.handleKeyboardEvent(evt('a', { ctrlKey: true, shiftKey: true }))
        expect(fn).toHaveBeenCalledOnce()
    })

    it("matches a cmd combination written in any order", () => {
        const fn = vi.fn()
        const km = new Keymap({ 'cmd+shift+a': fn })

        km.handleKeyboardEvent(evt('a', { metaKey: true, shiftKey: true }))
        expect(fn).toHaveBeenCalledOnce()
    })
})

