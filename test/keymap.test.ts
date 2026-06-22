import { describe, it, expect, vi  } from "vitest";
import { Keymap } from "../src/keymap"
import { parseInput } from "../src/keys";

describe("new Keymap", () => {
    it("can take nothing", () => {
        const keymap = new Keymap()
    })
    it("can take object", () => {
        const fn = () => {}
        const keymap = new Keymap({
            'a': fn
        })
        expect(keymap.get('a')).toEqual(fn)
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
        const newFn = vi.fn()
        const km = new Keymap({ 'a': oldFn })

        km.load({ 'b': newFn })

        // old binding is gone...
        expect(km.get('a')).toBeUndefined()
        km.type('a')
        expect(oldFn).not.toHaveBeenCalled()

        // ...and the new one is active
        expect(km.get('b')).toEqual(newFn)
        km.type('b')
        expect(newFn).toHaveBeenCalledOnce()
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
