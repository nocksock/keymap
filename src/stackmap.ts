import { raise } from "./errors"
import { mergeDistinctPrefix } from "./maps"

type Options = {
    shadowByPrefix: boolean
}

export type PushOptions = {
    exclusive: true
}

export interface StackMap<V> extends Map<string, V> {}

export class StackMap<V> {
    #stack: Map<string, V>[] = []
    #map = new Map<string, V>()
    #options = {shadowByPrefix: false}

    constructor(opts?: Options) {
        if (opts) {
            this.#options = Object.assign({}, this.#options, opts)
        }

        return new Proxy(this, {
            get(target, prop, _receiver) {
                if (prop in target.#map) {
                    // @ts-ignore
                    const value = target.#map[prop];
                    return typeof value === 'function' ? value.bind(target.#map) : value;
                }
                // @ts-ignore
                const value = target[prop];
                return typeof value === 'function' ? value.bind(target) : value;
            }
        })
    }

    push(map: Record<string, V>, opts: PushOptions) {
        this.#stack.push(this.#map)

        if (this.#options.shadowByPrefix && !opts?.exclusive) {
            this.#map = mergeDistinctPrefix(this.#map, map);
            return this;
        } 

        this.#map = new Map(Object.entries(map))

        return this
    }

    pop() {
        const map = this.#stack.pop() 
        if (map) {
            this.#map = map;
        }
        return this
    }
} 
