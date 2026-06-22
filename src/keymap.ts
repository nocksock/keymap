import { raise } from "./errors";
import { stringifyKeyInput } from "./keys";

export type Binding<Context = unknown> = {
    /** so the can be grouped in eg. "navigation", "formatting" */
    group?: string
    description?: string,
    effect: (context: Context) => void
}

export type BindingFunction<Context> = (context: Context) => void
export type AnyBinding<Context> = Binding<Context> | BindingFunction<Context>
export type TypeState = 'pending' | 'handled' | 'unhandled'

export class Keymap<Context = unknown> {
    #map = new Map();
    #buffer: string[] = []

    constructor(initial?: Record<string, AnyBinding<Context>>) {
        if (initial) this.set(initial)
    }

    set(a1: string | Record<string, AnyBinding<Context>>, a2?: AnyBinding<Context>): this {
        if (typeof a1 === 'object') {
            Object.entries(a1).forEach(([keys, binding]) => {
                return this.set(keys, binding)
            })
            return this;
        }

        if (typeof a1 !== 'string' || !(['function', 'object'].includes(typeof a2))) {
            raise(`Invalid keymap entry: ${a1} => ${typeof a2}`)
        }

        this.#map.set(a1, a2);
        return this;
    }

    type(event: KeyboardEvent | string, ctx?: Context): void {
        event = (typeof event === 'string') ? event : stringifyKeyInput(event)
        this.#buffer.push(event)
        const current =this.#buffer.join(' ')
        const matches = this.find(current)
        if (matches.length === 1) {
            const effect = this.#map.get(current)
            // @ts-ignore
            if (typeof effect === 'function') {
                effect(ctx)
                this.#buffer = []
                return 'handled'
            }
        }
        if (matches.length === 0) {
            this.#buffer = []
            return 'unhandled'
        }

        return 'pending'
    }

    find(prefix: string): [string, Binding<Context>[]][]  {
        return [...this.#map.entries()
            .filter(([keys, _]) => keys.startsWith(prefix))]
    }

    // using an arrow function so it can be used as an event handler without needing to bind it
    handleKeyboardEvent = (e: KeyboardEvent) => {
        this.type(e)
    }

    get(key: string) {
        return this.#map.get(key)
    }

    load(bindings: Record<string, AnyBinding<Context>>) {
        this.#reset()
        this.set(bindings)
        return this
    }

    #reset() {
        this.#map.clear()
        this.#buffer = []
    }
}
