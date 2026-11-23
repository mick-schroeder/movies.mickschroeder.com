import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as history from "../pipeline/lib/history.ts"
import type { Movie } from "../pipeline/lib/types.ts"
import validateList from "../pipeline/lib/validate.ts"
import config from "../pipeline/config.ts"
import { pickTop, standingScores } from "../pipeline/rank.ts"
import type { RankHistory } from "../src/lib/types.ts"

const range = (from: number, to: number, step = 1) =>
  Array.from(
    { length: Math.abs((to - from) / step) },
    (_, i) => from + i * step
  )

describe("history", () => {
  const movie = (id: number): Movie => ({
    id,
    tmdb_id: id,
    title: `Movie ${id}`,
    imdb_id: `tt${id}`,
    poster_url: null,
    release_date: "2026-01-01",
  })
  const day = (date: string, ids: number[]) => ({ date, ids })

  it("adds a day and keeps movie details", () => {
    let h = history.addDay(
      history.empty(2026),
      "2026-11-22",
      [movie(1), movie(2)],
      { 1: 80, 2: 70 }
    )
    h = history.addDay(h, "2026-11-23", [movie(2), movie(3)], { 2: 75, 3: 60 })

    assert.deepEqual(h.days, [
      day("2026-11-22", [1, 2]),
      day("2026-11-23", [2, 3]),
    ])
    assert.deepEqual(Object.keys(h.movies), ["1", "2", "3"])
    assert.deepEqual(h.scores, { 2: 75, 3: 60 })
    history.validate(h)
  })

  it("replaces the day on a rerun", () => {
    let h = history.addDay(history.empty(2026), "2026-11-23", [movie(1)], {})
    h = history.addDay(h, "2026-11-23", [movie(2)], {})
    assert.deepEqual(h.days, [day("2026-11-23", [2])])
  })

  it("rejects a bad history", () => {
    const movies = {
      1: { title: "A", imdb_id: "tt1", poster_url: null, release_date: null },
    }
    const bad = (h: Partial<RankHistory>) => ({
      year: 2026,
      days: [],
      movies: {},
      scores: {},
      ...h,
    })
    assert.throws(
      () =>
        history.validate(
          bad({
            days: [day("2026-03-02", [1]), day("2026-03-01", [1, 1])],
            movies,
          })
        ),
      /out of order/
    )
    assert.throws(
      () => history.validate(bad({ days: [day("2026-03-01", [7])] })),
      /no movie details/
    )
    assert.throws(
      () =>
        history.validate(bad({ scores: { 1: "high" as unknown as number } })),
      /scores/
    )
  })
})

describe("standings", () => {
  const movies = (ids: number[]) => ids.map((id) => ({ id }))

  it("blends tonight into the standing score", () => {
    // SMOOTHING 0.25: 0.25 * 100 + 0.75 * 60 = 70
    assert.deepEqual(standingScores(movies([1]), { 1: 100 }, { 1: 60 }), {
      1: 70,
    })
  })

  it("starts a new movie at tonight's score and keeps a skipped movie's standing", () => {
    assert.deepEqual(
      standingScores(movies([1, 2, 3]), { 1: 88 }, { 2: 64.5 }),
      { 1: 88, 2: 64.5 }
    )
  })

  it("drops movies that left the pool", () => {
    assert.deepEqual(standingScores(movies([1]), { 1: 50 }, { 1: 50, 9: 99 }), {
      1: 50,
    })
  })

  it("takes the top LIST_SIZE by standing score, best first", () => {
    const all = movies(range(1, 41))
    const scores = Object.fromEntries(all.map((m) => [m.id, m.id]))
    assert.deepEqual(
      pickTop(all, scores).ranked.map((m) => m.id),
      range(40, 40 - config.LIST_SIZE, -1)
    )
  })
})

describe("best-pictures.json", () => {
  const good = {
    title: "A",
    tmdb_id: 1,
    imdb_id: "tt1",
    poster_url: null,
    genres: [],
  }

  it("accepts the v1 format", () => {
    validateList("best-pictures.json", [good], {
      min: 1,
      max: 1,
      requireImdbId: true,
    })
  })

  it("rejects extra fields and bad ids", () => {
    assert.throws(
      () => validateList("best-pictures.json", [{ ...good, score: 9 }]),
      /Unrecognized key: "score"/
    )
    assert.throws(
      () =>
        validateList("best-pictures.json", [{ ...good, imdb_id: null }], {
          requireImdbId: true,
        }),
      /bad imdb_id/
    )
  })
})
