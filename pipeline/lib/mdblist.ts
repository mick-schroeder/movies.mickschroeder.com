import config from "../config.ts"
import type { MovieLinks } from "../../src/lib/types.ts"
import type { Movie } from "./types.ts"

type Ratings = Pick<
  Movie,
  | "imdb_rating"
  | "imdb_votes"
  | "rt_score"
  | "rt_audience_score"
  | "metacritic_score"
  | "letterboxd_rating"
  | "letterboxd_votes"
  | "links"
>

interface Rating {
  source: string
  value?: number
  votes?: number
  url?: string | number | null
}

interface MdblistMovie {
  ids: { tmdb: number }
  ratings?: Rating[]
}

// MDBList gives each site's path for the movie; turn them into full URLs.
// Only for sites with no page by IMDb or TMDB id (see src/lib/links.ts).
const SITES = {
  rottentomatoes: ["tomatoes", "https://www.rottentomatoes.com"],
  metacritic: ["metacritic", "https://www.metacritic.com/movie"],
} as const

function links(rating: (source: string) => Partial<Rating>): MovieLinks {
  const result: MovieLinks = {}
  for (const [site, [source, base]] of Object.entries(SITES)) {
    const path = rating(source).url
    if (typeof path === "string" && path.startsWith("/")) {
      result[site as keyof typeof SITES] = base + path
    }
  }
  return result
}

// Looks up ratings and audience size for many movies at once.
// Returns { [tmdbId]: { imdb_rating, imdb_votes, ... } }.
export default async function getRatings(
  tmdbIds: number[]
): Promise<Record<string, Ratings>> {
  const ratings: Record<string, Ratings> = {}

  for (let i = 0; i < tmdbIds.length; i += 100) {
    const ids = tmdbIds.slice(i, i + 100)
    const resp = await fetch(
      `https://api.mdblist.com/tmdb/movie?apikey=${config.MDBLIST_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }
    )

    if (!resp.ok) {
      throw new Error(`MDBList responded with ${resp.status} instead of 200`)
    }

    for (const movie of (await resp.json()) as MdblistMovie[]) {
      const rating = (source: string): Partial<Rating> =>
        movie.ratings?.find((r) => r.source === source) ?? {}

      ratings[movie.ids.tmdb] = {
        imdb_rating: rating("imdb").value ?? null,
        imdb_votes: rating("imdb").votes ?? null,
        rt_score: rating("tomatoes").value ?? null,
        rt_audience_score: rating("popcorn").value ?? null,
        metacritic_score: rating("metacritic").value ?? null,
        letterboxd_rating: rating("letterboxd").value ?? null,
        letterboxd_votes: rating("letterboxd").votes ?? null,
        links: links(rating),
      }
    }
  }

  return ratings
}
