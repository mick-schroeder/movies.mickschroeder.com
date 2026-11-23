import { setTimeout as sleep } from "node:timers/promises"
import config from "../config.ts"
import type { Movie } from "./types.ts"

interface TmdbMovie {
  id: number
  title: string
  release_date?: string
  popularity: number
  vote_average: number
  vote_count: number
  poster_path: string | null
}

interface TmdbPage {
  results: TmdbMovie[]
  total_pages: number
}

export interface TmdbDetails {
  id: number
  imdb_id: string | null
  release_date?: string
  revenue: number
  genres: { id: number; name: string }[]
}

// On a 429, waits for Retry-After (1s if missing) and tries again, up to `retries` times
async function request<T>(
  url: string,
  data: Record<string, string | number>,
  retries = 3
): Promise<T> {
  const params = new URLSearchParams({ api_key: config.TMDB_KEY })
  for (const [key, value] of Object.entries(data))
    params.set(key, String(value))
  const resp = await fetch(`https://api.themoviedb.org/3${url}?${params}`)

  if (resp.status === 429 && retries > 0) {
    await sleep((Number(resp.headers.get("retry-after")) || 1) * 1100)
    return request(url, data, retries - 1)
  }

  if (resp.status !== 200) {
    throw new Error(`TMDB responded with ${resp.status} instead of 200`)
  }

  return resp.json() as Promise<T>
}

const formatMovie = (movie: TmdbMovie): Movie => ({
  id: movie.id,
  title: movie.title,
  release_date: movie.release_date || null,
  popularity: movie.popularity,
  vote_average: movie.vote_average,
  vote_count: movie.vote_count,
  poster_url: movie.poster_path
    ? config.TMDB_POSTER_URL + movie.poster_path
    : null,
})

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

function discover(page: number) {
  const today = new Date()
  const from = new Date(today)
  from.setUTCDate(from.getUTCDate() - config.DAYS_BACK)

  return request<TmdbPage>("/discover/movie", {
    sort_by: "popularity.desc",
    "vote_count.gte": config.MIN_VOTES_ALL_LISTS,
    "vote_average.gte": config.MIN_TMDB_RATING,
    page,
    language: "en-US",
    region: "US",
    "primary_release_date.gte": isoDate(from),
    "primary_release_date.lte": isoDate(today),
  })
}

/** Every movie released in the last DAYS_BACK days that passes the vote filters. */
export async function getMovies(): Promise<Movie[]> {
  const first = await discover(1)
  const movies = [...first.results]

  for (let page = 2; page <= first.total_pages; page++) {
    movies.push(...(await discover(page)).results)
  }

  return movies.filter(Boolean).map(formatMovie)
}

export function getMovie(id: number) {
  return request<TmdbDetails>(`/movie/${id}`, {})
}

/** The TMDB id for an IMDb id, or null if TMDB doesn't know it. */
export async function findByImdbId(imdbId: string): Promise<number | null> {
  const found = await request<{ movie_results: { id: number }[] }>(
    `/find/${imdbId}`,
    { external_source: "imdb_id" }
  )
  return found.movie_results[0]?.id ?? null
}

export async function searchMovie(title: string, year?: number) {
  const query: Record<string, string | number> = {
    query: title.replace(/[^\w\s]/gi, ""),
  }
  if (year) query.year = year

  const { results } = await request<TmdbPage>("/search/movie", query)
  return results[0] && formatMovie(results[0])
}
