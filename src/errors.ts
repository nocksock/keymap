export function raise(msg: string): never {
  throw new Error("[keymap]: " + msg);
}

export function invariant(condition: any, msg: string): asserts condition {
  !condition && raise(msg);
}
