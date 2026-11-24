// best-pictures-YYYY.json: the best movies released in a year, best first. The
// site's year pages list these files as they are.
import { FIRST_YEAR, LIST_SIZE } from "../../src/consts.ts"
import type { Catalog, RankDay, Scores } from "../../src/lib/types.ts"

export const yearFilename = (year: number) => `best-pictures-${year}.json`

/** Every year with a list, oldest first, up to the latest night's. */
export function listYears(rankings: RankDay[]): number[] {
  const last = Number(rankings.at(-1)?.date.slice(0, 4) ?? FIRST_YEAR)
  return Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)
}

/**
 * The ids of every movie released in `year` that has been ranked (or, with no
 * release date, first ranked that year), best first. From the first year this
 * site scored movies itself, by standing score (unscored movies after, by
 * points); before that, by points: each night it was ranked, #1 earns the list
 * size and the last spot 1, totalled over its whole run.
 */
export function yearList(
  rankings: RankDay[],
  catalog: Catalog,
  scores: Scores,
  year: number
): number[] {
  const points = new Map<number, number>()
  const seen = new Set<number>()
  for (const night of rankings) {
    night.ids.forEach((id, i) => {
      if (!seen.has(id)) {
        seen.add(id)
        const released = catalog[id]?.release_date ?? night.date
        if (released.startsWith(`${year}-`)) points.set(id, 0)
      }
      if (points.has(id)) points.set(id, points.get(id)! + LIST_SIZE - i)
    })
  }
  const firstScored = rankings.find((night) => !night.source)?.date
  const scored = firstScored && year >= Number(firstScored.slice(0, 4))
  const score = (id: number) => (scored ? (scores[id] ?? -1) : -1)
  return [...points.keys()].toSorted(
    (a, b) => score(b) - score(a) || points.get(b)! - points.get(a)!
  )
}
