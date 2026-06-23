import { describe, it, expect, vi  } from "vitest";
import { Keymap } from "../src/keymap"
import { parseInput } from "../src/keys";

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

        expect(fn).toHaveBeenCalledWith(ctx)
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
