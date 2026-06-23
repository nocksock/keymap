import { describe, it, expect } from "vitest";
import { KeyInput, parseDefinition, parseInput, canonicalize, isModifier } from "../src/keys"

const def = (key: string) => ({
  key,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
})

const modKey = (name: keyof KeyInput) => (key: KeyInput | string) => (
  Object.assign(typeof key === 'string' ? def(key) : key, {
    [name]: true
  }))

const cmd = modKey('metaKey')
const shift = modKey('shiftKey')
const ctrl = modKey('ctrlKey')
const alt = modKey('altKey')

describe("modifier helpers", () => {
    it("is commutative", () => {
        expect(cmd(ctrl(shift(alt('a'))))).toEqual(shift(cmd(alt(ctrl('a')))))
    })
})

describe('keymap parser', () => {
  it('should parse basic keymaps', () => {
    const result: KeyInput = def('a')

    expect(parseDefinition('a b')).toEqual([
      def('a'),
      def('b'),
    ])
  })

  it('should parse modifier keys', () => {
    const result: KeyInput = def('a')

    expect(parseInput('Cmd+Ctrl+a')).toEqual(cmd(ctrl('a')))
    expect(parseInput('Ctrl+Cmd+a')).toEqual(cmd(ctrl('a')))
    expect(parseInput('Ctrl+a')).toEqual(ctrl('a'))
    expect(parseInput('Shift+a')).toEqual(shift('a'))
    expect(parseInput('Alt+a')).toEqual(alt('a'))
    expect(parseInput('Alt+Shift+a')).toEqual(shift(alt('a')))

    expect(parseDefinition("ctrl+a ctrl+x")).toEqual([
      ctrl('a'), ctrl('x')
    ])

    expect(parseDefinition("ctrl+a ctrl+x")).toEqual([
      ctrl('a'), ctrl('x')
    ])

    const invalids = [
      'ctrl shift',
      'ctrl+',
      'shift++',
    ].forEach((def) => {
      expect(() => parseDefinition(def)).toThrow()
    })
  })

  it('should parse super modifier (OS-dependent: cmd on macOS, ctrl elsewhere)', () => {
    // super = the primary modifier for the OS
    const result = parseInput('super+a')
    
    // Should have exactly one of metaKey or ctrlKey set to true
    const hasCmd = result.metaKey
    const hasCtrl = result.ctrlKey
    
    expect(hasCmd || hasCtrl).toBe(true)
    expect(hasCmd && hasCtrl).toBe(false) // but not both
    expect(result.shiftKey).toBe(false)
    expect(result.altKey).toBe(false)
    expect(result.key).toBe('a')
  })
})

describe('parseDefinition — whitespace', () => {
  it('collapses repeated internal spaces', () => {
    expect(parseDefinition('a  b')).toEqual([def('a'), def('b')])
    expect(parseDefinition('a  b  c')).toEqual([def('a'), def('b'), def('c')]) // 2nd gap too
  })

  it('trims leading and trailing whitespace', () => {
    expect(parseDefinition('  a b  ')).toEqual([def('a'), def('b')])
  })

  it('treats tabs/newlines as separators', () => {
    expect(parseDefinition('a\tb')).toEqual([def('a'), def('b')])
  })
})

describe('parseInput — normalization', () => {
  it('lowercases the key (capital letters and named keys)', () => {
    expect(parseInput('Shift+A')).toEqual(shift('a'))
    expect(parseInput('CTRL+B')).toEqual(ctrl('b'))
    expect(parseInput('Escape')).toEqual(def('escape'))
  })

  it('is order-independent for 3+ modifiers', () => {
    expect(parseInput('shift+ctrl+alt+a')).toEqual(parseInput('alt+shift+ctrl+a'))
  })

  it("normalizes '-' between modifiers, including chains", () => {
    expect(parseInput('ctrl-a')).toEqual(ctrl('a'))
    expect(parseInput('ctrl-shift-a')).toEqual(ctrl(shift('a')))
  })

  it('parses named keys', () => {
    for (const k of ['escape', 'esc', 'space', 'tab', 'enter', 'arrowup', 'f1', 'f12', 'home', 'pagedown']) {
      expect(parseInput(k)).toEqual(def(k))
    }
    expect(parseInput('ctrl+arrowleft')).toEqual(ctrl('arrowleft'))
  })

  it('parses number and symbol keys', () => {
    expect(parseInput('1')).toEqual(def('1'))
    expect(parseInput('ctrl+/')).toEqual(ctrl('/'))
    expect(parseInput('ctrl+-')).toEqual(ctrl('-')) // the minus key, not a separator
  })
})

describe('parseInput — invalid input', () => {
  it('throws on an empty input', () => {
    expect(() => parseInput('')).toThrow()
  })

  it('throws on a lone modifier (no key)', () => {
    expect(() => parseInput('ctrl')).toThrow()
  })

  it('throws on an out-of-range function key', () => {
    expect(() => parseInput('f13')).toThrow()
  })

  it("can't express the '+' key (separator collision) — documents the limitation", () => {
    expect(() => parseInput('+')).toThrow()
  })
})

describe('canonicalize', () => {
  it('normalizes modifier order to ctrl, alt, shift, cmd', () => {
    expect(canonicalize('shift+ctrl+a')).toBe('ctrl+shift+a')
    expect(canonicalize('cmd+shift+a')).toBe('shift+cmd+a')
  })

  it('lowercases and normalizes the separator', () => {
    expect(canonicalize('A')).toBe('a')
    expect(canonicalize('Ctrl-A')).toBe('ctrl+a')
  })

  it('preserves multi-key sequences', () => {
    expect(canonicalize('g g')).toBe('g g')
    expect(canonicalize('ctrl+a b')).toBe('ctrl+a b')
  })

  it('accepts a KeyInput and stringifies it', () => {
    expect(canonicalize(ctrl('b'))).toBe('ctrl+b')
  })

  it('is idempotent', () => {
    const once = canonicalize('cmd+shift+a')
    expect(canonicalize(once)).toBe(once)
  })

  it('falls back to the lowercased input when it cannot parse', () => {
    expect(canonicalize('ctrl+')).toBe('ctrl+')
  })
})

describe('isModifier', () => {
  it('recognizes every modifier token, in both event-key and canonical form', () => {
    for (const m of ['control', 'shift', 'alt', 'meta', 'ctrl', 'cmd']) {
      expect(isModifier(m)).toBe(true)
    }
  })

  it('rejects non-modifier keys', () => {
    for (const k of ['a', 'space', 'escape', 'f1']) {
      expect(isModifier(k)).toBe(false)
    }
  })
})
