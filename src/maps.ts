export const filterByPrefix = <R>(map: Map<string, R>, prefix: string) => {
    return [...map.entries().filter(([keys, _]) => keys.startsWith(prefix))]
}

export const rejectByPrefix = <R>(map: Map<string, R>, prefix: string) => {
    return [...map.entries().filter(([keys, _]) => !keys.startsWith(prefix))]
}

const toEntries = <C>(m: Map<string, C> | Record<string, C>): [string, C][] =>
    m instanceof Map ? [...m.entries()] : Object.entries(m)

export const mergeDistinctPrefix = <C>(base: Map<string, C> | Record<string, C>, overlay: Map<string, C> | Record<string, C>): Map<string, C> => {
    const overlayEntries = toEntries(overlay);
    const baseEntries = toEntries(base)
    const distinctEntries = baseEntries.filter(
        ([bk, _]) => !overlayEntries.some(
            ([ok, _]) => ok.startsWith(bk) || bk.startsWith(ok)
        )
    ).concat(overlayEntries)

    return new Map([...distinctEntries])
}
