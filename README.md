# keymap

A tiny keyboard-shortcut dispatcher: bind keys (and multi-key sequences) to actions, with stackable layers for modal UIs.

- **~3.27 kB** minified, **~1.54 kB** gzipped
- **Zero dependencies**
- Single-key, modifier, and multi-key Vim-style sequences (`g g`, `d w`)
- Stackable layers (`push`/`pop`) for modes and contextual overrides
- Works with raw `KeyboardEvent`s, with `preventDefault` handled for you

## Install

```ts
import { Keymap } from "@nocksock/keymap"
```

## Quick start

```ts
const editor = new Keymap({
  'j': () => moveDown(),
  'k': () => moveUp(),
  'ctrl+s': () => save(),
})

document.addEventListener('keydown', editor.handleKeyboardEvent)
```

> **Tip:** the test suite (`test/`) doubles as documentation — it's the most thorough, runnable set of usage examples, covering every feature and edge case described below.

## Bindings

A binding map pairs a key string with an action. An action is either a plain function or an object with an `effect`:

```ts
const km = new Keymap({
  'a': () => doThing(),
  'b': { group: 'edit', description: 'do other thing', effect: () => doOther() },
})
```

Passing anything else (e.g. a number) throws:

```ts
new Keymap({ 'a': 123 }) // throws
```

### Key syntax

| Form | Example | Matches |
|------|---------|---------|
| Single key | `'a'` | the `a` key |
| Modifier | `'ctrl+b'`, `'shift+h'` | modifier + key |
| Named key | `'escape'`, `'space'` | `Escape`, the spacebar |
| Sequence | `'g g'`, `'g a b'` | keys pressed in order |

Modifiers and named keys register in canonical lowercase. A `Shift+H` press matches a `'shift+h'` binding; a spacebar press matches `'space'`.

### Key overview

Keys are case-insensitive (a capital letter is `shift+<letter>`). Any single character below, or a named key, is valid:

| Group | Keys |
|-------|------|
| Letters | `a`–`z` |
| Digits | `0`–`9` |
| Symbols | `` ` `` `~` `!` `@` `#` `$` `%` `^` `&` `*` `(` `)` `-` `=` `[` `]` `{` `}` `\` `\|` `;` `:` `'` `"` `,` `.` `<` `>` `/` `?` `_` |
| Named | `space` `tab` `enter` `backspace` `delete` `escape` (alias `esc`) `home` `end` `pageup` `pagedown` |
| Arrows | `arrowup` `arrowdown` `arrowleft` `arrowright` (aliases `up` `down` `left` `right`) |
| Function | `f1`–`f12` |
| Modifiers | `ctrl` `cmd` (alias `meta`) `shift` `alt` `super` (cmd on macOS, ctrl elsewhere) |

Notes:

- Combine modifiers with `+` (or `-`, e.g. `ctrl-s`); order doesn't matter (`shift+ctrl+a` === `ctrl+shift+a`).
- Aliases resolve to their canonical key (`up` → `arrowup`, `esc` → `escape`), so a binding and the matching event always agree.
- `super` resolves per-OS, so `super+s` is ⌘S on macOS and Ctrl+S elsewhere.
- The literal `+` key can't be expressed (it's the separator) — use the other keys around it. `-` works as a key (e.g. `ctrl+-`).

## Dispatching keys

### `type(key, ctx?)`

Feeds one key to the map and runs the matching action. The `key` can be a string or a `KeyboardEvent`-shaped object.

```ts
km.type('a')
km.type('ctrl+b')
km.type(escapeEvent) // { key: 'Escape', ... }
```

`type` returns the outcome:

| Result | Meaning |
|--------|---------|
| `'handled'` | a binding matched and fired |
| `'unhandled'` | nothing matched |
| `'pending'` | a multi-key sequence is partway through |

The result comes back synchronously, so you can drive UI from it — surface a which-key-style hint or a "waiting for the next key" indicator while a sequence is `'pending'`, clear it on `'handled'`, and optionally flash feedback on `'unhandled'`.

```ts
const km = new Keymap({ 'g g': goTop, 'g e': goEnd })

km.type('g') // 'pending' — waiting for the next key
km.type('g') // 'handled' — fires goTop
```

A broken sequence resets and reports `'unhandled'`:

```ts
km.type('g') // 'pending'
km.type('x') // 'unhandled' — 'g x' matches nothing; buffer resets
```

### Sequences always wait on a prefix

A key that is a prefix of a longer binding waits instead of firing early — even when it is the only candidate. This is what makes operator + motion (e.g. `d w`) work:

```ts
const km = new Keymap({ 'd w': deleteWord })

km.type('d') // 'pending' — never fires on its own
km.type('w') // 'handled' — fires deleteWord
```

The same holds when one map defines both a key and a longer sequence starting with it:

```ts
const km = new Keymap({ 'g': goLine, 'g g': goTop })

km.type('g') // 'pending' — won't fire goLine early
km.type('g') // 'handled' — fires goTop
```

### `handleKeyboardEvent(event)`

The DOM entry point. It dispatches the event and calls `preventDefault()` for matched keys (see below). Lone modifier presses (a bare `Shift`, `Ctrl`, …) are ignored and never pollute a pending sequence:

```ts
km.handleKeyboardEvent(gEvent)     // 'pending'
km.handleKeyboardEvent(shiftEvent) // ignored
km.handleKeyboardEvent(gEvent)     // completes 'g g'
```

`handleKeyboardEvent` is permanently bound to its keymap, so you can pass it straight to `addEventListener` / `removeEventListener` — no wrapping arrow, no `.bind`. Attach it to `document`, `window`, or any element, and detaching is symmetric:

```ts
// in a custom element
connectedCallback() {
  this.addEventListener('keydown', this.km.handleKeyboardEvent)
}
disconnectedCallback() {
  this.removeEventListener('keydown', this.km.handleKeyboardEvent)
}
```

## Context and the effect signature

Effects receive a context object. Anything you pass as the second `type` argument is exposed as `context`:

```ts
const km = new Keymap({ 'a': (ctx) => console.log(ctx.context) })
km.type('a', { selection: '…' }) // ctx.context === { selection: '…' }
```

Object-form bindings receive the same context as plain functions.

## preventDefault

Matched keys call `event.preventDefault()` by default; unmatched keys pass through untouched.

Opt out per binding:

```ts
new Keymap({ 'a': { preventDefault: false, effect: doThing } })
```

Or opt out at runtime, for one press only:

```ts
new Keymap({ 'a': (ctx) => ctx.permitDefault() })
```

`permitDefault()` is not sticky — a later press of the same key prevents the default again.

### Pending keys

By default only *matched* keys prevent the default — an incomplete sequence (the `g` of `g g`) passes through. Opt in to prevent the default on pending keys too, so a half-typed prefix never leaks a browser shortcut. Set it for the whole keymap, or per binding:

```ts
new Keymap({ 'g g': goTop }, { pendingPreventDefault: true })   // keymap-wide
new Keymap({ 'g g': { pendingPreventDefault: true, effect: goTop } }) // single binding
```

## Layers (`push` / `pop`)

Layers stack on top of the base map for modal behaviour. The topmost layer wins; keys it doesn't define fall through to layers below.

```ts
const km = new Keymap({ 'j': moveDown, 'k': moveUp })

km.push({ 'j': nudgeSelection }) // overrides only 'j'
km.type('j')                     // nudgeSelection
km.type('k')                     // moveUp — fell through
km.pop()                         // back to the base 'j'
```

`push` and `pop` are LIFO, and `push` is chainable. `pop()` on an empty stack is a no-op — it never removes the base, and over-popping never corrupts the stack.

### Exclusive layers

A normal `push` shadows: keys the layer doesn't define fall through to layers below. An **exclusive** layer doesn't — it hides everything beneath it, so only its own keys resolve. Use it for truly modal states (a command palette, a confirm prompt) where the base bindings should be unreachable.

```ts
const km = new Keymap({ 'j': moveDown, 'k': moveUp })

km.push({ 'x': confirm }, { exclusive: true })
km.type('j') // 'unhandled' — base is hidden, no fall-through
km.type('x') // confirm
km.pop()     // base reachable (and merging) again
```

`list()` reflects only the exclusive layer while it's active. Exclusive and shadowing layers stack together in LIFO order — an exclusive layer hides everything below it until it's popped.

### Mode switching from an effect

An effect can push a layer; it takes effect for the next key:

```ts
const km = new Keymap({
  'i': () => km.push({ 'escape': () => km.pop(), 'x': insertX }),
})

km.type('i') // enter "insert mode"
km.type('x') // insertX
```

### Layers and shared prefixes

The topmost layer that has any candidate — complete *or* partial — for the current buffer owns the resolution. Lower layers can't extend or complete a buffer the top already claims. This keeps sequence resolution decidable without timers.

```ts
// Top defines 'g' as complete → it shadows a base 'g g' entirely
const km = new Keymap({ 'g g': goTop })
km.push({ 'g': goLine })
km.type('g') // 'handled' — goLine; base 'g g' is unreachable while pushed

// Top defines 'g g' → it claims the 'g' prefix, shadowing a base 'g'
const km2 = new Keymap({ 'g': goLine })
km2.push({ 'g g': goTop })
km2.type('g') // 'pending' — top owns the prefix, base 'g' stays shadowed
km2.type('g') // 'handled' — goTop
```

Popping the layer restores the base behaviour exactly.

## Introspection

### `get(key)`

Returns the stored binding for a key (or `undefined`). Object-form bindings keep their `group` and `description`:

```ts
km.get('a') // { group: 'nav', description: 'do a', effect: … }
```

### `list()`

Returns one entry per active binding — `{ keys, group?, description? }` — for building help overlays or cheat sheets. It is stack-aware: a pushed layer shadows the base for the same key, so each key appears once, with the active layer's metadata. Re-read it after each `push`/`pop` to keep a live which-key panel or cheat sheet in sync with the current mode.

```ts
const km = new Keymap({
  'j': { group: 'nav', description: 'down', effect: moveDown },
  'k': { group: 'nav', description: 'up',   effect: moveUp },
})

km.list()
// [
//   { keys: 'j', group: 'nav', description: 'down' },
//   { keys: 'k', group: 'nav', description: 'up' },
// ]
```

### `current()`

Returns the active resolution map (base merged with pushed layers).

## Replacing bindings

### `load(bindings)`

Replaces the entire base map. It also clears any pushed layers and resets the pending buffer, giving you a clean slate. Chainable.

```ts
km.load({ 'b': newAction }) // old bindings gone, stack cleared
   .load({ /* … */ })       // returns the keymap
```

### `set(key, action)`

Overwrites or adds a single binding.

```ts
km.set('x', replacement)
```

## Resetting the buffer

### `reset()`

Cancels an in-progress sequence without touching pushed layers. It's detached from `this`, so you can wire it straight to a `blur` listener:

```ts
input.addEventListener('blur', km.reset)
```

```ts
km.type('g') // 'pending'
km.reset()   // buffer cleared; layers untouched
km.type('g') // a fresh first 'g'
```

## Notes

- Re-entrant effects are safe: an effect may call `type` again without corrupting the buffer.
- The pending buffer stays bounded — sustained unmatched input always resets it, never grows it.
- Popped layers are released for garbage collection.

## API reference

| Member | Returns | Description |
|--------|---------|-------------|
| `new Keymap(bindings?, options?)` | `Keymap` | Create a keymap, optionally seeded with a binding map. Options: `{ pendingPreventDefault }`. |
| `set(key, action)` / `set(map)` | `this` | Add or overwrite a single binding, or a whole map. |
| `type(key, ctx?)` | `'handled' \| 'pending' \| 'unhandled'` | Dispatch one key (string or `KeyboardEvent`) and run the match. |
| `handleKeyboardEvent(event)` | `void` | DOM handler — dispatches and calls `preventDefault()` for matches. Permanently bound. |
| `reset()` | `void` | Clear the pending sequence buffer. Permanently bound. |
| `push(map, options?)` | `this` | Push a layer. `{ exclusive: true }` hides everything below it. |
| `pop()` | `this` | Remove the top layer (no-op on an empty stack). |
| `load(bindings)` | `this` | Replace the base map; also clears layers and the buffer. |
| `get(key)` | `binding \| undefined` | The stored binding for a key. |
| `list()` | `{ keys, group?, description? }[]` | Active bindings, stack-aware — for help overlays. |
| `current()` | `Map` | The active resolution map (base merged with layers). |
| `context` | `UserContext` | Property passed to effects dispatched via `handleKeyboardEvent`. |

## Handcrafted

This library is artisanal, hand-written code. Every line of the library source (`src/`) is 100% human-written — no LLM-generated implementation. LLM assistance was used **only** to help write the test suite and this README; the design and implementation are entirely human.
