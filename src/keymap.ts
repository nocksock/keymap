import { raise } from "./errors";
import { isModifier, stringifyKeyInput } from "./keys";
import { filterByPrefix } from "./maps";
import { PushOptions, StackMap } from "./stackmap";

export type EffectContext<UserContext> = {
    permitDefault: () => void
    context: UserContext,
}

export type Binding<Context = unknown> = {
    /** so the can be grouped in eg. "navigation", "formatting" */
    group?: string
    description?: string,
    preventDefault?: boolean,
    effect: (context: EffectContext<Context>) => void
    [ORIGINAL]?: BindingFunction<Context>
}

export type BindingFunction<Context> = (context: EffectContext<Context>) => void
export type AnyBinding<Context> = Binding<Context> | BindingFunction<Context>
export type TypeState = 'pending' | 'handled' | 'unhandled'

const ORIGINAL = Symbol()

export class Keymap<UserContext> {
    #map = new StackMap<Binding<UserContext>>({
        shadowByPrefix: true
    });
    #buffer: string[] = []
    context?: UserContext;

    constructor(initial?: Record<string, AnyBinding<UserContext>>) {
        if (initial) this.set(initial)
    }

    set(keyOrMap: string | Record<string, AnyBinding<UserContext>>, a2?: AnyBinding<UserContext>): this {
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

    type(event: KeyboardEvent | string, ctx?: UserContext) {
        // normalize
        const keyInput = (typeof event === 'string')
            ? event.toLowerCase()
            : stringifyKeyInput(event)

        // prevent lone modifiers to mess up the buffer
        if (isModifier(keyInput)) return;

        this.#buffer.push(keyInput)

        const current = this.#buffer.join(' ')
        const matches = filterByPrefix(this.#map, current)

        if (matches.length === 0) {
            this.#buffer = []
            return 'unhandled'
        }

        if (matches.length > 1) {
            return 'pending'
        }

        const [keys, binding] = matches[0];
        if (current.length < keys.length) {
            return 'pending'
        }

        // --- we have a match! ---

        const { effect } = binding
        this.#buffer = [] // clear buffer early, so effects may call .type()

        let preventDefault = binding.preventDefault ?? true
        const permitDefault = () => preventDefault = false
        effect({ permitDefault, context: ctx as UserContext })

        if (preventDefault && typeof event !== 'string' && 'preventDefault' in event) {
            event.preventDefault()
        }

        return 'handled'
    }


    // using an arrow function so it can be used as an event handler without needing to bind it
    handleKeyboardEvent = (e: KeyboardEvent) => {
        this.type(e, this.context)
    }

    reset = () => {
        this.#buffer = []
    }

    #normalizeBinding(binding: AnyBinding<UserContext>): Binding<UserContext> {
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

    #unwrapBinding(binding: Binding<UserContext>): AnyBinding<UserContext> {
        // @ts-ignore
        return binding[ORIGINAL]
    }

    get(key: string) {
        const binding = this.#map.get(key)
        return binding ? this.#unwrapBinding(binding) : undefined
    }

    load(bindings: Record<string, AnyBinding<UserContext>>) {
        this.#fullReset()
        this.set(bindings)
        return this
    }

    push(map: Record<string, AnyBinding<UserContext>>, opts: PushOptions) {
        const normalized = Object.fromEntries(
            Object.entries(map).map(([k, b]) => [k, this.#normalizeBinding(b)])
        );
        this.#map.push(normalized, opts);
        return this;
    }

    pop() { this.#map.pop(); return this; }

    #fullReset() {
        this.#map.reset()
        this.#buffer = []
    }

    current() {
        return this.#map
    }

    list() {
        return [...this.#map.entries()].map(([keys, binding]) => {
            return {
                ...binding,
                keys
            }
        })
    }

}
