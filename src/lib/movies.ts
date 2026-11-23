// Build-time data for the pages. Reads the files `pnpm build:data` writes to
// public/; without them (local dev, CI) uses the live site's files instead.
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { FIRST_YEAR, SITE } from "@/consts"
import type { HistoryMovie, ListMovie, RankHistory } from "@/lib/types"

/** A published file, or null if neither public/ nor the live site has it. */
async function load<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(
      await readFile(join(process.cwd(), "public", name), "utf8")
    )
  } catch {
    const resp = await fetch(`${SITE.url}/${name}`)
    if ([403, 404].includes(resp.status)) return null
    if (!resp.ok) throw new Error(`${name}: live site answered ${resp.status}`)
    return resp.json() as Promise<T>
  }
}

let standings: Promise<ListMovie[]> | undefined
/** Tonight's standings, best first. */
export function getStandings(): Promise<ListMovie[]> {
  standings ??= load<ListMovie[]>("best-pictures.json").then((list) => {
    if (!list) throw new Error("best-pictures.json not found")
    return list
  })
  return standings
}

let histories: Promise<RankHistory[]> | undefined
/** Every year's rank history that exists, oldest first. */
export function getHistories(): Promise<RankHistory[]> {
  const thisYear = new Date().getUTCFullYear()
  const years = Array.from(
    { length: thisYear - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i
  )
  histories ??= Promise.all(
    years.map((year) => load<RankHistory>(`best-pictures-${year}.json`))
  ).then((all) => all.filter((h): h is RankHistory => !!h?.days.length))
  return histories
}

export interface MovieSummary extends HistoryMovie {
  id: number
  genres: string[]
  /** Tonight's rank, or null if it isn't in tonight's standings. */
  tonight: number | null
  best: number | null
  nights: number
  firstNight: string | null
  lastNight: string | null
  /** The years it was in the standings. */
  years: RankHistory[]
}

/** Every movie that has been in the standings, or is tonight. */
export async function getMovies(): Promise<MovieSummary[]> {
  const [list, years] = await Promise.all([getStandings(), getHistories()])
  const movies = new Map<number, MovieSummary>()
  const get = (id: number, info: HistoryMovie) => {
    let movie = movies.get(id)
    if (!movie) {
      movie = {
        id,
        ...info,
        genres: [],
        tonight: null,
        best: null,
        nights: 0,
        firstNight: null,
        lastNight: null,
        years: [],
      }
      movies.set(id, movie)
    }
    return movie
  }

  for (const history of years) {
    for (const day of history.days) {
      day.ids.forEach((id, i) => {
        const movie = get(id, history.movies[id]!)
        // Later years have the latest details
        Object.assign(movie, history.movies[id])
        if (movie.years.at(-1) !== history) movie.years.push(history)
        movie.best = Math.min(movie.best ?? Infinity, i + 1)
        movie.nights++
        movie.firstNight ??= day.date
        movie.lastNight = day.date
      })
    }
  }

  list.forEach((item, i) => {
    const movie = get(item.tmdb_id, {
      title: item.title,
      imdb_id: item.imdb_id,
      poster_url: item.poster_url,
      release_date: null,
    })
    movie.tonight = i + 1
    movie.genres = item.genres
  })

  return [...movies.values()]
}
