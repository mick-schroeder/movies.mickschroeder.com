import config from "./config.ts"
import { scoreMovies } from "./lib/anthropic.ts"
import getRatings from "./lib/mdblist.ts"
import * as tmdb from "./lib/tmdb.ts"
import type { Movie, Scores } from "./lib/types.ts"

async function addTmdbDetails(movies: Movie[]) {
  for (const movie of movies) {
    const details = await tmdb.getMovie(movie.id)
    Object.assign(movie, {
      tmdb_id: details.id,
      imdb_id: details.imdb_id,
      revenue: details.revenue === 0 ? null : details.revenue,
      genres: tmdb.genreSlugs(details),
      runtime: details.runtime || null,
      trailer_url: tmdb.trailerUrl(details),
    })
  }
}

async function addRatings(movies: Movie[]) {
  const ratings = await getRatings(movies.map((movie) => movie.tmdb_id!))
  for (const movie of movies) Object.assign(movie, ratings[movie.tmdb_id!])
}

// Every movie released in the last DAYS_BACK days, with details and ratings
export async function getMovies(): Promise<Movie[]> {
  const unique = new Map((await tmdb.getMovies()).map((m) => [m.id, m]))
  const movies = [...unique.values()]
  await addTmdbDetails(movies)
  await addRatings(movies)
  console.table(movies, [
    "id",
    "imdb_id",
    "title",
    "release_date",
    "metacritic_score",
    "imdb_rating",
    "imdb_votes",
    "rt_score",
    "rt_audience_score",
    "letterboxd_rating",
    "letterboxd_votes",
    "vote_count",
    "revenue",
  ])
  return movies
}

// Each movie's standing score: a moving average of its nightly AI scores, so one noisy
// night moves it a little and a real change shows within a week or so.
// A new movie starts at tonight's score; a movie the AI skipped tonight keeps its standing.
export function standingScores(
  movies: { id: number }[],
  tonight: Scores,
  previous: Scores
): Scores {
  const scores: Scores = {}
  for (const { id } of movies) {
    const before = previous[id]
    const now = tonight[id]
    const score =
      before == null
        ? now
        : now == null
          ? before
          : config.SMOOTHING * now + (1 - config.SMOOTHING) * before
    if (score != null) scores[id] = Math.round(score * 10) / 10
  }
  return scores
}

// Only what the prompt describes, and no empty fields, to keep the request small
const PROMPT_FIELDS = [
  "id",
  "title",
  "release_date",
  "genres",
  "revenue",
  "rt_audience_score",
  "imdb_rating",
  "imdb_votes",
  "letterboxd_rating",
  "letterboxd_votes",
  "rt_score",
  "metacritic_score",
] as const

const promptData = (movie: Movie) =>
  Object.fromEntries(
    PROMPT_FIELDS.filter((key) => movie[key] != null).map((key) => [
      key,
      movie[key],
    ])
  ) as { id: number }

// Tonight's standings. `previousScores` is last night's { [tmdb_id]: standing score }.
// Returns LIST_SIZE full movie objects, best first, and every eligible movie's standing score.
export async function rankMovies(
  allMovies: Movie[],
  previousScores: Scores = {}
) {
  // Only score movies enough people have rated, so the ratings have settled.
  // best-pictures.json requires an imdb_id (consumers match on it), so skip movies without one.
  const movies = allMovies.filter(
    (movie) => movie.imdb_id && (movie.vote_count ?? 0) >= config.MIN_VOTES
  )
  console.log({
    candidates: allMovies.length,
    with_min_votes: movies.length,
    min_votes: config.MIN_VOTES,
  })

  if (movies.length < config.LIST_SIZE) {
    throw new Error(
      `Only ${movies.length} movies have ${config.MIN_VOTES} or more votes, need ${config.LIST_SIZE}. Lower MIN_VOTES or LIST_SIZE.`
    )
  }

  const tonight = await scoreMovies(movies.map(promptData))
  return pickTop(movies, standingScores(movies, tonight, previousScores))
}

// The LIST_SIZE movies with the highest standing scores. Movies with no score are left out,
// so if the AI scored too few, the size check in build.ts fails the run.
export function pickTop<T extends { id: number }>(movies: T[], scores: Scores) {
  const ranked = movies
    .filter((movie) => scores[movie.id] != null)
    .toSorted((a, b) => scores[b.id]! - scores[a.id]!)
    .slice(0, config.LIST_SIZE)
  return { ranked, scores }
}
