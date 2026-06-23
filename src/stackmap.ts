import { raise } from "./errors"

export interface StackMap<V> extends Map<string, V> {}

export class StackMap<V> {
    #stack: Map<string, V>[] = []
    #map = new Map<string, V>()

    constructor() {
        return new Proxy(this, {
            get(target, prop, receiver) {
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

    push(map: Record<string, V> | Map<string, V>) {
        this.#stack.push(this.#map)
        this.#map = new Map([...this.#map, ... (
            typeof map === 'object'
                ? map instanceof Map
                    ? map
                    : Object.entries(map)
                : raise("push expects Map or {}")
        )])

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
