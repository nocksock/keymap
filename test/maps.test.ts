import { describe, it, expect, vi  } from "vitest";
import { mergeDistinctPrefix } from "../src/maps.js"

describe("map helpers", () => {
    it("merge with distinct prefix", () => {
        const base = {
            "a": "base",
            "b": "base"
        }
        const overlay = {
            "a a": "overlay",
        }
        const expectation = new Map(Object.entries({
            "a a": "overlay",
            "b": "base"
        }))

        expect(mergeDistinctPrefix(base, overlay)).toEqual(expectation)
    })
})
