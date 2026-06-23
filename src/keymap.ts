import { raise } from "./errors";
import { stringifyKeyInput } from "./keys";
import { filterByPrefix } from "./maps";
import { StackMap } from "./stackmap";

export type Binding<Context = undefined> = {
    /** so the can be grouped in eg. "navigation", "formatting" */
    group?: string
    description?: string,
    effect: (context: Context) => void
}

export type BindingFunction<Context> = (context: Context) => void
export type AnyBinding<Context> = Binding<Context> | BindingFunction<Context>
export type TypeState = 'pending' | 'handled' | 'unhandled'

const ORIGINAL = Symbol()

export class Keymap<Context = undefined> {
    #map = new StackMap<Binding<Context>>({
        shadowByPrefix: true
    });
    #buffer: string[] = []
    context?: Context;

    constructor(initial?: Record<string, AnyBinding<Context>>) {
        if (initial) this.set(initial)
    }

    set(keyOrMap: string | Record<string, AnyBinding<Context>>, a2?: AnyBinding<Context>): this {
        if (typeof keyOrMap === 'object') {
            Object.entries(keyOrMap).forEach(([keys, binding]) => {
                return this.set(keys, binding)
            })
            return this;
        }

        if (!a2) {
            raise(`No binding given for ${keyOrMap}`)
        }

        if (typeof keyOrMap !== 'string' || !(['function', 'object'].includes(typeof a2))) {
            raise(`Invalid keymap entry: ${keyOrMap} => ${typeof a2}`)
        }

        this.#map.set(keyOrMap, this.#normalizeBinding(a2));
        return this;
    }

    type(event: KeyboardEvent | string, ctx?: Context) {
        event = (typeof event === 'string') ? event.toLowerCase() : stringifyKeyInput(event)
        this.#buffer.push(event)
        const current = this.#buffer.join(' ')
        const matches = filterByPrefix(this.#map, current)
        if (matches.length === 1 ) {
            const [keys, binding] = matches[0];
            if (current.length < keys.length) return 'pending'
            const {effect} = binding
            this.#buffer = [] // clear buffer early, so effects could call type
            if (typeof effect === 'function') {
                // @ts-ignore
                effect(ctx || this.context)
                return 'handled'
            }
        }
        if (matches.length === 0) {
            this.#buffer = []
            return 'unhandled'
        }

        return 'pending'
    }

    // using an arrow function so it can be used as an event handler without needing to bind it
    handleKeyboardEvent = (e: KeyboardEvent) => {
        this.type(e, this.context)
    }

    #normalizeBinding(binding: AnyBinding<Context>) {
        if (typeof binding === 'function') {
            return {
                effect: binding,
                // carry it around so .set and .get work as expected from
                // a user's POV, but internally we always have an object
                [ORIGINAL]: binding
            }
        }
        // @ts-ignore
        binding[ORIGINAL] = binding
        return binding
    }

    #unwrapBinding(binding: Binding<Context>): AnyBinding<Context> {
        // @ts-ignore
        return binding[ORIGINAL]
    }

    get(key: string) {
        const binding = this.#map.get(key)
        return binding ? this.#unwrapBinding(binding) : undefined
    }

    load(bindings: Record<string, AnyBinding<Context>>) {
        this.#reset()
        this.set(bindings)
        return this
    }

  push(map: Record<string, AnyBinding<Context>>) {
      const normalized = Object.fromEntries(
          Object.entries(map).map(([k, b]) => [k, this.#normalizeBinding(b)])
      );
      this.#map.push(normalized);
      return this;
  }


    pop() { this.#map.pop(); return this; }

    #reset() {
        this.#map.clear()
        this.#buffer = []
    }

    current() {
        return this.#map
    }
}
