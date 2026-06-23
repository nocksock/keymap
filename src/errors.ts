export function raise(msg: string): never {
  throw new Error("[keymap]: " + msg);
}
