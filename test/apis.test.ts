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

    it("gets a tmdb movie", async () => {
      const movie = await tmdb.getMovie(TMDB_ID)
      assert.equal(movie.title, MOVIE_TITLE)
      assert.equal(movie.imdb_id, IMDB_ID)
    })

    it("finds a tmdb id by imdb id", async () => {
      assert.equal(await tmdb.findByImdbId(IMDB_ID), TMDB_ID)
    })
  }
)
