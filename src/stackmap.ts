import { mergeDistinctPrefix } from "./maps"

type Options = {
    shadowByPrefix: boolean
}

export type PushOptions = {
    exclusive: true
}

export class StackMap<V> extends Map<string, V> {
    #stack: Map<string, V>[] = []
    #shadowByPrefix: boolean

    constructor(opts?: Options) {
        super()
        this.#shadowByPrefix = opts?.shadowByPrefix ?? false
    }

    #replace(next: Map<string, V>) {
        this.clear()
        for (const [key, value] of next) this.set(key, value)
    }

    push(map: Record<string, V>, opts?: PushOptions) {
        this.#stack.push(new Map(this))
        this.#replace(
            opts?.exclusive
                ? new Map(Object.entries(map))                  // only the new layer
                : this.#shadowByPrefix
                    ? mergeDistinctPrefix(this, map)            // fall through, drop prefix conflicts
                    : new Map([...this, ...Object.entries(map)]) // fall through, override
        )
        return this
    }

    pop() {
        const previous = this.#stack.pop()
        if (previous) this.#replace(previous)
        return this
    }

    reset() {
        const base = this.#stack[0] ?? new Map()
        this.#stack = []
        this.#replace(base)
    }
}
