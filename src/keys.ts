import { raise } from './errors'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

export const isModifier = (key: string): key is Modifier => MODIFIER_KEYS.includes(key as any)

// A valid key is a single char (\w covers a-z0-9_, plus the symbol class) or a named key.
const VALID_KEY = /^([\w`~!@#$%^&*()\-=+[{}\]\\|;:'",<.>/?]|space|tab|enter|backspace|delete|escape|esc|(arrow)?(up|down|left|right)|f[1-9]|f1[0-2]|home|end|page(up|down))$/
const ALIAS_KEYS = {
    // <alias> : <canonical>
    'up': 'arrowup',
    'down': 'arrowdown',
    'left': 'arrowleft',
    'right': 'arrowright',
    'esc': 'escape',
    ' ': 'space',
}

export const parseDefinition = (definition: string) =>
  definition
    .trim()
    .split(/\s+/)
    .map(parseInput)

export const parseInput = (input: string): KeyInput => {
  // Normalize "-" separator to "+" when used between modifiers (e.g. Ctrl-s → ctrl+s)
  const normalized = input.toLowerCase().replace(/(?<=(ctrl|cmd|shift|alt|super))-/g, '+')
  const mods = normalized.split("+")
  const key = mods.at(-1) || ''
  if (!VALID_KEY.test(key)) raise(`Invalid key definition: ${input}`)

  // super expands to cmd on macOS, ctrl elsewhere
  const hasSuper = mods.includes('super')

  return {
    ctrlKey: mods.includes('ctrl') || (hasSuper && !IS_MAC),
    altKey: mods.includes('alt'),
    metaKey: mods.includes('cmd') || mods.includes('meta') || (hasSuper && IS_MAC),
    shiftKey: mods.includes('shift'),
    // @ts-ignore
    key: ALIAS_KEYS[key] || key
  }
}

export const canonicalize = (input: string | KeyInput): string => {
  if (typeof input !== 'string') return stringifyKeyInput(input)
  try {
    return parseDefinition(input).map(stringifyKeyInput).join(' ')
  } catch {
    return input.toLowerCase()
  }
}

const stringifyKeyInput = (key: KeyInput) => {
  const mods = [];
  if (key.ctrlKey) mods.push('ctrl');
  if (key.altKey) mods.push('alt');
  if (key.shiftKey) mods.push('shift');
  if (key.metaKey) mods.push('cmd');
  const namedKey = key.key.toLowerCase();
  if (!isModifier(namedKey)) {
    mods.push(ALIAS_KEYS[namedKey as keyof typeof ALIAS_KEYS] || namedKey);
  }
  return mods.join('+');
};

// both DOM event-key names ('control', 'meta') and our canonical aliases ('ctrl', 'cmd')
const MODIFIER_KEYS = ['control', 'shift', 'alt', 'meta', 'ctrl', 'cmd'] as const

export type Modifier = 'ctrl' | 'cmd' | 'shift' | 'alt' | 'super'

export type KeyInput = Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'key'>
