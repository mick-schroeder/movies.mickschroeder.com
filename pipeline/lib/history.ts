import * as z from "zod"
import type { HistoryMovie, RankHistory } from "../../src/lib/types.ts"
import config from "../config.ts"
import type { Movie, Scores } from "./types.ts"

// Rank history, one file per calendar year (best-pictures-YYYY.json); see RankHistory.

export const filename = (year: number) => `best-pictures-${year}.json`

export const empty = (year: number): RankHistory => ({
  year,
  days: [],
  movies: {},
  scores: {},
})

// Downloads a year's history from the live site. A missing file (CloudFront
// answers 403 or 404) returns null only when `allowMissing` is set; anything
// else throws, so a bad download can't replace a year of history with nothing.
export async function load(
  year: number,
  { allowMissing = false } = {}
): Promise<RankHistory | null> {
  const url = `${config.SITE_URL}/${filename(year)}`
  const resp = await fetch(url)

  if (resp.ok) return resp.json() as Promise<RankHistory>
  if ([403, 404].includes(resp.status) && allowMissing) return null
  throw new Error(`${url} responded with ${resp.status}`)
}

// Records `movies` (best first) as the ranking for `date`, and tonight's standing scores.
// A rerun on the same date replaces it.
export function addDay(
  history: RankHistory,
  date: string,
  movies: Movie[],
  scores: Scores
): RankHistory {
  const days = history.days.filter((day) => day.date !== date)
  days.push({ date, ids: movies.map((movie) => movie.tmdb_id!) })

  const movieInfo: Record<string, HistoryMovie> = {}
  for (const movie of movies) {
    const { tmdb_id, title, imdb_id, poster_url, release_date, links } = movie
    movieInfo[tmdb_id!] = {
      title,
      imdb_id: imdb_id!,
      poster_url,
      release_date,
      ...(links && { links }),
    }
  }

  return {
    year: history.year,
    days: days.toSorted((a, b) => a.date.localeCompare(b.date)),
    movies: { ...history.movies, ...movieInfo },
    scores,
  }
}

// The file's shape; the checks across days and movies are in validate()
const schema = z.object({
  year: z.int(),
  days: z.array(
    z.object({
      date: z.iso.date(),
      ids: z.array(z.int()).min(1).max(config.LIST_SIZE),
      source: z.literal("stevenlu").optional(),
    })
  ),
  movies: z.record(z.string(), z.looseObject({ title: z.string().min(1) })),
  scores: z.record(z.string(), z.number()),
})

// Throws if the history isn't safe to publish
export function validate(history: RankHistory) {
  const name = filename(history?.year)
  const result = schema
    .superRefine(({ year, days, movies }, ctx) => {
      const error = (message: string) =>
        ctx.addIssue({ code: "custom", message })
      days.forEach(({ date, ids }, i) => {
        if (!date.startsWith(`${year}-`))
          error(`day ${i} has date ${date} outside ${year}`)
        if (i > 0 && date <= days[i - 1]!.date)
          error(`day ${i} (${date}) is out of order`)
        if (new Set(ids).size !== ids.length) error(`${date} repeats an id`)
        for (const id of ids) {
          if (!movies[id]) error(`${date} has id ${id} with no movie details`)
        }
      })
    })
    .safeParse(history)

  if (!result.success) {
    throw new Error(
      `${name} failed validation:\n${z.prettifyError(result.error)}`
    )
  }
}
