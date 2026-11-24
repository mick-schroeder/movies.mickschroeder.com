import * as z from "zod"
import type {
  Catalog,
  ListMovie,
  RankDay,
  Scores,
} from "../../src/lib/types.ts"
import config from "../config.ts"
import type { Movie } from "./types.ts"

// Everything the nightly build carries from one night to the next (see src/lib/types.ts).
// It lives on the live site under data/; each run downloads it, adds tonight, and writes it back.
export interface Data {
  rankings: RankDay[]
  catalog: Catalog
  scores: Scores
}

export const FILES = {
  rankings: "data/rankings.json",
  catalog: "data/movies.json",
  scores: "data/scores.json",
} as const

/** A night's public list: best-pictures-YYYYMMDD.json, like Steven Lu's movies-YYYYMMDD.json. */
export const datedFilename = (date: string) =>
  `best-pictures-${date.replaceAll("-", "")}.json`

async function download<T>(path: string): Promise<T | null> {
  const url = `${config.SITE_URL}/${path}`
  const resp = await fetch(url)
  if (resp.ok) return resp.json() as Promise<T>
  // CloudFront answers 403 or 404 for a missing file
  if ([403, 404].includes(resp.status)) return null
  throw new Error(`${url} responded with ${resp.status}`)
}

// Downloads the data from the live site. If it isn't there, returns null when
// `allowMissing` is set and throws otherwise, so a bad download can't replace
// the history with nothing.
export async function load({ allowMissing = false } = {}) {
  const [rankings, catalog, scores] = await Promise.all([
    download<RankDay[]>(FILES.rankings),
    download<Catalog>(FILES.catalog),
    download<Scores>(FILES.scores),
  ])
  if (rankings && catalog && scores) return { rankings, catalog, scores }
  if (allowMissing && !rankings) return null
  throw new Error(
    `${config.SITE_URL}/data/ is missing a file (first run? use --new-history)`
  )
}

// Records `movies` (best first) as the standings for `date`, refreshes their details,
// and keeps tonight's standing scores. A rerun on the same date replaces it.
export function addNight(
  data: Data,
  date: string,
  movies: Movie[],
  scores: Scores
): Data {
  const rankings = data.rankings.filter((night) => night.date !== date)
  rankings.push({ date, ids: movies.map((movie) => movie.tmdb_id!) })

  const catalog = { ...data.catalog }
  for (const movie of movies) {
    const { tmdb_id, title, imdb_id, poster_url, release_date } = movie
    const { genres = [], runtime = null, trailer_url = null, links } = movie
    catalog[tmdb_id!] = {
      title,
      imdb_id: imdb_id!,
      poster_url,
      release_date,
      genres,
      runtime,
      trailer_url,
      ...(links && Object.keys(links).length && { links }),
    }
  }

  return {
    rankings: rankings.toSorted((a, b) => a.date.localeCompare(b.date)),
    catalog,
    scores,
  }
}

/** A night's standings in the public list format. */
export const toList = (ids: number[], catalog: Catalog): ListMovie[] =>
  ids.map((id) => {
    const { title, imdb_id, poster_url, genres } = catalog[id]!
    return { title, tmdb_id: id, imdb_id, poster_url, genres }
  })

// The files' shapes; the checks across nights and movies are in validate()
const schema = z.object({
  rankings: z.array(
    z.object({
      date: z.iso.date(),
      ids: z.array(z.int()).min(1).max(config.LIST_SIZE),
      source: z.literal("stevenlu").optional(),
    })
  ),
  catalog: z.record(
    z.string(),
    z.object({
      title: z.string().min(1),
      imdb_id: z.string().regex(/^tt\d+$/),
      poster_url: z.string().nullable(),
      release_date: z.iso.date().nullable(),
      genres: z.array(z.string()),
      runtime: z.int().positive().nullable(),
      trailer_url: z.url().nullable(),
      links: z
        .object({
          rottentomatoes: z.url().optional(),
          metacritic: z.url().optional(),
        })
        .optional(),
    })
  ),
  scores: z.record(z.string(), z.number()),
})

// Throws if the data isn't safe to publish
export function validate(data: Data) {
  const result = schema
    .superRefine(({ rankings, catalog }, ctx) => {
      const error = (message: string) =>
        ctx.addIssue({ code: "custom", message })
      rankings.forEach(({ date, ids }, i) => {
        if (i > 0 && date <= rankings[i - 1]!.date)
          error(`night ${i} (${date}) is out of order`)
        if (new Set(ids).size !== ids.length) error(`${date} repeats an id`)
        for (const id of ids) {
          if (!catalog[id]) error(`${date} has id ${id} with no movie details`)
        }
      })
    })
    .safeParse(data)

  if (!result.success) {
    throw new Error(
      `data/ failed validation:\n${z.prettifyError(result.error)}`
    )
  }
}
