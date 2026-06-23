import { bench, describe } from "vitest";
import { Keymap } from "../src/keymap";
import { StackMap } from "../src/stackmap";

// Hot path: type() is called on every keystroke, so these guard the per-key cost.
describe("type() hot path", () => {
    const small = new Keymap({ 'a': () => {}, 'g g': () => {}, 'g e': () => {} })
    bench("single-key match", () => { small.type('a') })
    bench("no match (unhandled)", () => { small.type('z') })
    bench("two-key sequence", () => { small.type('g'); small.type('g') })

    // scaling: matching is O(active bindings) per keystroke — watch this grow
    const big: Record<string, () => void> = {}
    for (let i = 0; i < 1_000; i++) big['k' + i] = () => {}
    const large = new Keymap(big)
    bench("match in a 1000-entry map", () => { large.type('k999') })

    // realistic DOM path (event normalization + preventDefault wiring)
    const evt = { key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault() {} } as any
    bench("handleKeyboardEvent (real event path)", () => { small.handleKeyboardEvent(evt) })
})

// Mode switches push/pop layers — cheaper than the hot path but still worth tracking.
describe("stack ops", () => {
    const km = new Keymap({ 'j': () => {} })
    bench("push + pop", () => { km.push({ 'j': () => {} }); km.pop() })
})

// Quantifies the proxy's per-access .bind() cost vs a plain Map (which returns a
// stable prototype method). The gap is the allocation the StackMap proxy adds to
// every hot-path `map.entries()` call.
describe("proxy property-access cost", () => {
    const sm = new StackMap()
    const plain = new Map()
    bench("StackMap proxy: access .entries (binds per access)", () => { void (sm as any).entries })
    bench("plain Map: access .entries (stable, no alloc)", () => { void plain.entries })
})
