import { describe, it, expect } from "vitest";
import { StackMap } from "../src/stackmap.js"

describe("StackMap", () => {
    it("is a map", () => {
        const smap = new StackMap()
        const bar = {}
        smap.set("foo", bar)
        expect(smap.get("foo")).toEqual(bar)
    })
    it("can stack", () => {
        const smap = new StackMap()
        const foo = { value: "foo" }
        const bar = { value: "bar" }
        const fallthrough = { value: "baz" }
        smap.push({ foo: foo, fallthrough })
        smap.push({ foo: bar })
        expect(smap.get("fallthrough")).toEqual(fallthrough)
        expect(smap.get("foo")).toEqual(bar)
        smap.pop()
        expect(smap.get("baz")).toEqual(undefined)
        expect(smap.get("foo")).toEqual(foo)
    })
    it.only("can shadow prefixes", () => {
        const smap = new StackMap({ shadowByPrefix: true })
        smap.set("f", "base")
        smap.set("o", "base")
        smap.push({ "ff": "layer" })
        expect(smap.get("f")).toBeUndefined()
        expect(smap.get("o")).toBe("base")
        expect(smap.get("ff")).toBe("layer")
    })
})
