import { Binding } from './keymap'
import { raise } from './errors'

const isMacOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) 
      || /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

export const isModifier = (key: string): key is Modifier => MODIFIER_KEYS.includes(key as any)
export const isValidKey = (key: string): key is Key => VALID_KEYS.includes(key as any)

export const parseDefinition = (definition: string) =>
  definition
    .replace(/\s+/, " ")
    .split(" ")
    .map(parseInput)

export const parseInput = (input: string): KeyInput => {
  // Normalize "-" separator to "+" when used between modifiers (e.g. Ctrl-s → ctrl+s)
  const normalized = input.toLowerCase().replace(/(?<=(ctrl|cmd|shift|alt|super|hyper|meh))-/g, '+')
  const mods = normalized.split("+")
  const key = mods.at(-1) || raise(`Invalid key definition: ${input}`)
  if (!isValidKey(key)) raise(`Invalid key definition: ${input}`)

  // Handle special modifiers
  const hasMeh = mods.includes('meh')     // ctrl + shift + alt
  const hasHyper = mods.includes('hyper') // ctrl + shift + alt + cmd
  const hasSuper = mods.includes('super') // cmd on macOS, ctrl elsewhere
  
  // Validate no redundant combinations
  if (hasHyper) {
    if (mods.includes('ctrl')) raise('hyper already includes ctrl')
    if (mods.includes('shift')) raise('hyper already includes shift')
    if (mods.includes('alt')) raise('hyper already includes alt')
    if (mods.includes('cmd') || mods.includes('meta')) raise('hyper already includes cmd')
  }
  
  if (hasMeh) {
    if (mods.includes('ctrl')) raise('meh already includes ctrl')
    if (mods.includes('shift')) raise('meh already includes shift')
    if (mods.includes('alt')) raise('meh already includes alt')
  }
  
  // super expands to either cmd or ctrl based on OS
  const superIsCmd = hasSuper && isMacOS()
  const superIsCtrl = hasSuper && !isMacOS()

  return {
    ctrlKey: mods.includes('ctrl') || hasMeh || hasHyper || superIsCtrl,
    altKey: mods.includes('alt') || hasMeh || hasHyper,
    metaKey: mods.includes('cmd') || mods.includes('meta') || hasHyper || superIsCmd,
    shiftKey: mods.includes('shift') || hasMeh || hasHyper,
    key
  }
}

export const same = (a: KeyInput, b: KeyInput) =>
  a.key === b.key
  && a.ctrlKey === b.ctrlKey
  && a.altKey === b.altKey
  && a.shiftKey === b.shiftKey
  && a.metaKey === b.metaKey;

export const stringifyKeyInput = (key: KeyInput) => {
  const mods = [];
  if (key.ctrlKey) mods.push('ctrl');
  if (key.altKey) mods.push('alt');
  if (key.shiftKey) mods.push('shift');
  if (key.metaKey) mods.push('cmd');
  if (!isModifier(key.key.toLowerCase())) {
    mods.push(normalizeEventKey(key.key));
  }
  return mods.join('+');
};

// Most keys match by lowercasing (e.g. 'Escape' → 'escape'), 
// but the spacebar reports `key === ' '` which would not match the 'space' in VALID_KEYS.
const normalizeEventKey = (key: string) => (key === ' ' ? 'space' : key.toLowerCase())

export const filterKeymap = (keymap: ParsedKeymap, buffer: KeyboardEvent[]) =>
  keymap.filter(([pattern]) => {
    if (pattern.length < buffer.length) return false;
    return buffer.every((input, index) => {
      const patternKey = pattern[index];
      return normalizeEventKey(input.key) === patternKey.key
        && input.ctrlKey === patternKey.ctrlKey
        && input.altKey === patternKey.altKey
        && input.shiftKey === patternKey.shiftKey
        && input.metaKey === patternKey.metaKey;
    });
  });

type Chord = `${ValidModifier<Modifier>}+${Key}`
type ValidModifier<T extends string> =
  T extends Modifier
  ? T : T extends `${Modifier}+${infer R}`
  ? T extends `${infer F}+${R}`
  ? `${F}+${Exclude<ValidModifier<R>, F>}`
  : never
  : Modifier


export type ParsedKeymap = [KeyInput[], Binding?][]

// prettier-ignore
export type ValidKeymap<T extends string> =
  T extends Key
  ? T : T extends Chord
  ? T : T extends `${Chord} ${infer R}`
  ? T extends `${infer F} ${R}`
  ? `${F} ${ValidKeymap<R>}`
  : never
  : Chord

const MODIFIER_KEYS = ['control', 'shift', 'alt', 'meta'] as const

const LETTER_KEYS = [...'abcdefghijklmnopqrstuvwxyz'] as const

const NUMBER_KEYS = [...'0123456789'] as const

const SYMBOL_KEYS = [...'`~!@#$%^&*()-_=+[{}]\\|;:\'",<.>/?'] as const

const SPECIAL_KEYS = ['space', 'tab', 'enter', 'backspace', 'delete', 'escape', 'esc'] as const

const NAVIGATION_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'] as const

const FUNCTION_KEYS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'] as const

const PAGE_KEYS = ['home', 'end', 'pageup', 'pagedown'] as const

export const VALID_KEYS = [...LETTER_KEYS, ...NUMBER_KEYS, ...SYMBOL_KEYS,
...SPECIAL_KEYS, ...NAVIGATION_KEYS, ...FUNCTION_KEYS,
...PAGE_KEYS] as const

export type Key = typeof VALID_KEYS[number]
export type Modifier = 'ctrl' | 'cmd' | 'shift' | 'alt' | 'super' | 'hyper' | 'meh'

export type KeyInput = Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'key'>
