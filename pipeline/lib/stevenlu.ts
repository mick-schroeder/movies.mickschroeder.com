// Backfills the rankings from Steven Lu's popular-movies lists
// (https://github.com/sjlu/popular-movies), the project this one forked from.
// He publishes each night's list as movies-YYYYMMDD.json; some nights are missing.
import { gunzipSync } from "node:zlib"
import type { Catalog, ListMovie, RankDay } from "../../src/lib/types.ts"
import config from "../config.ts"
import { catalogMovie } from "./data.ts"
import getRatings from "./mdblist.ts"
import * as tmdb from "./tmdb.ts"

const BASE_URL = "https://popular-movies-data.stevenlu.com"
/** His first dated list. */
const FIRST_DATE = "2019-12-02"

// Lists before 2023 have only an imdb_id (and no genres)
type StevenLuMovie = Partial<ListMovie> & { imdb_id?: string }

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

/** Every night before `until` (YYYY-MM-DD) that has a Steven Lu list, marked as his, and the movies in them. */
export async function backfill(
  until: string
): Promise<{ rankings: RankDay[]; catalog: Catalog }> {
  const dates: string[] = []
  for (let t = Date.parse(FIRST_DATE); ; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10)
    if (date >= until) break
    dates.push(date)
  }

  // Ten lists at a time
  const lists: (StevenLuMovie[] | null)[] = []
  for (let i = 0; i < dates.length; i += 10) {
    lists.push(...(await Promise.all(dates.slice(i, i + 10).map(getList))))
  }

  const rankings: RankDay[] = []
  const imdbIds = new Map<number, string>()
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
      imdbIds.set(id, movie.imdb_id)
    }
    if (ids.length) rankings.push({ date, ids, source: "stevenlu" })
  }

  // His lists vary in what they include, so every movie's details come from TMDB
  const ratings = await getRatings([...imdbIds.keys()])
  const catalog: Catalog = {}
  for (const [id, imdbId] of imdbIds) {
    const details = await tmdb.getMovie(id)
    const links = ratings[id]?.links
    catalog[id] = catalogMovie({
      id,
      title: details.title,
      imdb_id: details.imdb_id || imdbId,
      poster_url: tmdb.posterUrl(details.poster_path),
      backdrop_url: tmdb.backdropUrl(details.backdrop_path),
      release_date: details.release_date || null,
      genres: tmdb.genreSlugs(details),
      runtime: details.runtime || null,
      trailer_url: tmdb.trailerUrl(details),
      ...(links && { links }),
    })
  }

  console.log({
    stevenlu_nights: rankings.length,
    stevenlu_movies: Object.keys(catalog).length,
  })
  return { rankings, catalog }
}
