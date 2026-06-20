import { describe, it, expect } from "vitest";
import { KeyInput, parseDefinition, parseInput } from "../src/keys"

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

  it('should parse meh modifier (ctrl+shift+alt)', () => {
    // meh = ctrl + shift + alt (everything except cmd/meta)
    expect(parseInput('meh+a')).toEqual(
      ctrl(shift(alt('a')))
    )
  })

  it('should parse hyper modifier (ctrl+shift+alt+cmd)', () => {
    // hyper = all four modifiers
    expect(parseInput('hyper+a')).toEqual(
      cmd(ctrl(shift(alt('a'))))
    )
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

  it('should throw error for redundant hyper combinations', () => {
    expect(() => parseInput('hyper+ctrl+a')).toThrow('hyper already includes ctrl')
    expect(() => parseInput('hyper+shift+a')).toThrow('hyper already includes shift')
    expect(() => parseInput('hyper+alt+a')).toThrow('hyper already includes alt')
    expect(() => parseInput('hyper+cmd+a')).toThrow('hyper already includes cmd')
  })

  it('should throw error for redundant meh combinations', () => {
    expect(() => parseInput('meh+ctrl+a')).toThrow('meh already includes ctrl')
    expect(() => parseInput('meh+shift+a')).toThrow('meh already includes shift')
    expect(() => parseInput('meh+alt+a')).toThrow('meh already includes alt')
  })
})
