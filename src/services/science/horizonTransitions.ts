export type Crossing = { time: number; direction: 'Rises' | 'Sets' }

// Refine brackets to one minute. A crossing cannot be established through an unknown ray.
export function findCrossings(start: number, end: number, clearance: (time: number) => number | null): Crossing[] {
  const minute = 60_000
  const events: Crossing[] = []
  let left = start, a = clearance(left)
  while (left < end) {
    const right = Math.min(end, left + 10 * minute)
    const b = clearance(right)
    if (a !== null && b !== null && (a > 0) !== (b > 0)) {
      let lo = left, hi = right
      let resolved = true
      while (hi - lo > minute) {
        const mid = (lo + hi) / 2
        const value = clearance(mid)
        if (value === null) { resolved = false; break }
        if ((value > 0) === (a > 0)) lo = mid
        else hi = mid
      }
      if (resolved) events.push({ time: Math.round((lo + hi) / 2 / minute) * minute, direction: b > 0 ? 'Rises' : 'Sets' })
    }
    left = right
    a = b
  }
  return events
}

export function compareCrossings(nominal: Crossing[], alternative: Crossing[]) {
  // Pair only matching full transition sequences. Extra or missing events make an ordinal match ambiguous.
  const comparable = nominal.length === alternative.length &&
    nominal.every((event, index) => event.direction === alternative[index].direction)
  return nominal.map((event, index) => {
    const alternate = comparable ? alternative[index].time : null
    return { ...event, earliest: alternate === null ? null : Math.min(event.time, alternate),
      latest: alternate === null ? null : Math.max(event.time, alternate) }
  })
}
