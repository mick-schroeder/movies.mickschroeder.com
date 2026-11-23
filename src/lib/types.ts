// The published file formats, shared by the nightly pipeline and the site.

/** One movie in best-pictures.json (the v1 format, same as the StevenLu popular-movies lists). */
export interface ListMovie {
  title: string
  tmdb_id: number
  imdb_id: string
  poster_url: string | null
  genres: string[]
}

/** One night's standings in best-pictures-YYYY.json: tmdb ids, best first. */
export interface RankDay {
  date: string // YYYY-MM-DD
  ids: number[]
  /** Set on nights backfilled from Steven Lu's popular-movies lists, before this site's own rankings began. */
  source?: "stevenlu"
}

/** Pages about a movie on other sites, where known (from MDBList). */
export interface MovieLinks {
  rottentomatoes?: string
  metacritic?: string
  letterboxd?: string
  trakt?: string
}

/** What best-pictures-YYYY.json keeps about each movie that has been in the standings. */
export interface HistoryMovie {
  title: string
  imdb_id: string
  poster_url: string | null
  release_date: string | null
  links?: MovieLinks
}

/** best-pictures-YYYY.json: every night's standings for a calendar year. */
export interface RankHistory {
  year: number
  days: RankDay[] // oldest first
  movies: Record<string, HistoryMovie>
  scores: Record<string, number> // standing score after the latest night
}
