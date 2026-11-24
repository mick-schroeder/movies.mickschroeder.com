// The published files, shared by the nightly pipeline and the site.
//
// Public contract, Steven Lu's popular-movies format (an array of ListMovie):
//   best-pictures.json            the current standings
//   best-pictures-YYYYMMDD.json   each night's standings, like his movies-YYYYMMDD.json
//
// The site's own working data, not a contract (free to change):
//   data/rankings.json   every night's tmdb ids, best first (RankDay[])
//   data/movies.json     details of every movie that has been in the standings (Catalog)
//   data/scores.json     the latest standing scores the pipeline smooths from (Scores)

/** One movie in best-pictures.json and best-pictures-YYYYMMDD.json. Don't change it. */
export interface ListMovie {
  title: string
  tmdb_id: number
  imdb_id: string
  poster_url: string | null
  genres: string[]
}

/** One night's standings in data/rankings.json: tmdb ids, best first. */
export interface RankDay {
  date: string // YYYY-MM-DD
  ids: number[]
  /** Set on nights backfilled from Steven Lu's popular-movies lists, before this site's own rankings began. */
  source?: "stevenlu"
}

/** Pages about a movie that can't be built from its ids (from MDBList). */
export interface MovieLinks {
  rottentomatoes?: string
  metacritic?: string
}

/** One movie in data/movies.json. */
export interface CatalogMovie {
  title: string
  imdb_id: string
  poster_url: string | null
  release_date: string | null
  genres: string[]
  /** In minutes. */
  runtime: number | null
  /** A YouTube trailer. */
  trailer_url: string | null
  links?: MovieLinks
}

/** data/movies.json, by tmdb id. */
export type Catalog = Record<string, CatalogMovie>

/** data/scores.json: { [tmdb_id]: standing score } after the latest night. */
export type Scores = Record<string, number>
