// A movie as it moves through the pipeline: TMDB discover fields, then details, then ratings.
import type { MovieLinks } from "../../src/lib/types.ts"

export type { Scores } from "../../src/lib/types.ts"

export interface Movie {
  id: number
  title: string
  release_date: string | null
  popularity?: number
  vote_average?: number
  vote_count?: number
  poster_url: string | null
  /** A wide, text-free still, for page backgrounds. */
  backdrop_url?: string | null
  tmdb_id?: number
  imdb_id?: string | null
  revenue?: number | null
  genres?: string[]
  runtime?: number | null
  trailer_url?: string | null
  imdb_rating?: number | null
  imdb_votes?: number | null
  rt_score?: number | null
  rt_audience_score?: number | null
  metacritic_score?: number | null
  letterboxd_rating?: number | null
  letterboxd_votes?: number | null
  mdblist_score?: number | null
  links?: MovieLinks
}
