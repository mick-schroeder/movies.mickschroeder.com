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
  title: string
  imdb_id: string | null
  poster_path: string | null
  release_date?: string
  revenue: number
  runtime: number | null
  genres: { id: number; name: string }[]
  videos: { results: TmdbVideo[] }
}

interface TmdbVideo {
  site: string
  type: string
  key: string
  official: boolean
  iso_639_1: string
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

export const posterUrl = (path: string | null) =>
  path ? config.TMDB_POSTER_URL + path : null

// "Science Fiction" -> "science_fiction"
export const genreSlugs = (details: TmdbDetails) =>
  details.genres.map((genre) =>
    genre.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .join("_")
  )

/** The movie's YouTube trailer, official and English first, or null. */
export function trailerUrl(details: TmdbDetails) {
  const trailers = details.videos.results.filter(
    (video) => video.site === "YouTube" && video.type === "Trailer"
  )
  const rank = (video: TmdbVideo) =>
    Number(!video.official) + Number(video.iso_639_1 !== "en")
  const best = trailers.toSorted((a, b) => rank(a) - rank(b))[0]
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null
}

const formatMovie = (movie: TmdbMovie): Movie => ({
  id: movie.id,
  title: movie.title,
  release_date: movie.release_date || null,
  popularity: movie.popularity,
  vote_average: movie.vote_average,
  vote_count: movie.vote_count,
  poster_url: posterUrl(movie.poster_path),
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
  return request<TmdbDetails>(`/movie/${id}`, {
    append_to_response: "videos",
  })
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
