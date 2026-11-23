// Calls the real TMDB and MDBList APIs; skipped unless their keys are set (.env).
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import getRatings from "../pipeline/lib/mdblist.ts"
import * as tmdb from "../pipeline/lib/tmdb.ts"

const IMDB_ID = "tt11564570"
const TMDB_ID = 661374
const MOVIE_TITLE = "Glass Onion: A Knives Out Mystery"

describe(
  "apis",
  { skip: !process.env.TMDB_KEY || !process.env.MDBLIST_KEY },
  () => {
    it("gets mdblist ratings", async () => {
      const ratings = (await getRatings([TMDB_ID]))[TMDB_ID]!
      assert.ok(ratings.imdb_rating! > 1)
      assert.ok(ratings.imdb_votes! > 1000)
      assert.ok(ratings.rt_score! > 1)
      assert.ok(ratings.metacritic_score! > 1)
    })

    it("finds a tmdb movie", async () => {
      const movie = await tmdb.searchMovie(MOVIE_TITLE)
      assert.equal(movie?.id, TMDB_ID)
      assert.ok(movie.popularity! > 1)
      assert.equal(typeof movie.release_date, "string")
    })

    it("gets a tmdb movie's imdb id", async () => {
      assert.equal((await tmdb.getMovie(TMDB_ID)).imdb_id, IMDB_ID)
    })
  }
)
