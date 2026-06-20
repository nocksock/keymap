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
