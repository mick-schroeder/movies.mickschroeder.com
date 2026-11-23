// Backfills a year's rank history from Steven Lu's popular-movies lists
// (https://github.com/sjlu/popular-movies), the project this one forked from.
// He publishes each night's list as movies-YYYYMMDD.json; some nights are missing.
import { gunzipSync } from "node:zlib"
import type { ListMovie, RankHistory } from "../../src/lib/types.ts"
import config from "../config.ts"
import getRatings from "./mdblist.ts"
import * as tmdb from "./tmdb.ts"

const BASE_URL = "https://popular-movies-data.stevenlu.com"

// Lists before 2023 have only an imdb_id
type StevenLuMovie = Omit<ListMovie, "tmdb_id"> & { tmdb_id?: number }

async function getList(date: string): Promise<StevenLuMovie[] | null> {
  const resp = await fetch(
    `${BASE_URL}/movies-${date.replaceAll("-", "")}.json`
  )
  if ([403, 404].includes(resp.status)) return null
  if (!resp.ok)
    throw new Error(`Steven Lu list ${date} responded with ${resp.status}`)
  // Some archived lists are stored gzipped but served as plain JSON
  const bytes = Buffer.from(await resp.arrayBuffer())
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  return JSON.parse(
    (gzipped ? gunzipSync(bytes) : bytes).toString("utf8")
  ) as StevenLuMovie[]
}

const tmdbIds = new Map<string, number | null>()
async function tmdbId(movie: StevenLuMovie) {
  if (Number.isInteger(movie.tmdb_id)) return movie.tmdb_id!
  if (!movie.imdb_id) return null
  if (!tmdbIds.has(movie.imdb_id))
    tmdbIds.set(movie.imdb_id, await tmdb.findByImdbId(movie.imdb_id))
  return tmdbIds.get(movie.imdb_id)!
}

/** Every night of `year` before `until` (YYYY-MM-DD) that has a Steven Lu list, marked as his. */
export async function backfill(
  year: number,
  until: string
): Promise<RankHistory> {
  const history: RankHistory = { year, days: [], movies: {}, scores: {} }

  const dates: string[] = []
  for (let t = Date.UTC(year, 0, 1); ; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10)
    if (date >= until || !date.startsWith(`${year}-`)) break
    dates.push(date)
  }

  // Ten lists at a time
  const lists: (StevenLuMovie[] | null)[] = []
  for (let i = 0; i < dates.length; i += 10) {
    lists.push(...(await Promise.all(dates.slice(i, i + 10).map(getList))))
  }

  for (const [i, date] of dates.entries()) {
    const list = lists[i]
    if (!list) continue

    const ids: number[] = []
    // Older lists ran longer than the standings; keep the top of each
    for (const movie of list) {
      if (ids.length === config.LIST_SIZE) break
      const id = await tmdbId(movie)
      if (id === null || !movie.imdb_id || ids.includes(id)) continue
      ids.push(id)
      history.movies[id] ??= {
        title: movie.title,
        imdb_id: movie.imdb_id,
        poster_url: movie.poster_url?.replace(/^http:/, "https:") ?? null,
        release_date: null,
      }
    }
    if (ids.length) history.days.push({ date, ids, source: "stevenlu" })
  }

  // His lists have no release dates or links to other sites, so look them up
  const ratings = await getRatings(Object.keys(history.movies).map(Number))
  for (const [id, movie] of Object.entries(history.movies)) {
    movie.release_date = (await tmdb.getMovie(Number(id))).release_date || null
    const links = ratings[id]?.links
    if (links) movie.links = links
  }

  console.log({
    stevenlu_days: history.days.length,
    stevenlu_movies: Object.keys(history.movies).length,
  })
  return history
}
