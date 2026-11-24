import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as data from "../pipeline/lib/data.ts"
import type { Movie } from "../pipeline/lib/types.ts"
import validateList from "../pipeline/lib/validate.ts"
import config from "../pipeline/config.ts"
import { pickTop, standingScores } from "../pipeline/rank.ts"
import { listYears, yearList } from "../pipeline/lib/years.ts"

const range = (from: number, to: number, step = 1) =>
  Array.from(
    { length: Math.abs((to - from) / step) },
    (_, i) => from + i * step
  )

describe("data", () => {
  const movie = (id: number): Movie => ({
    id,
    tmdb_id: id,
    title: `Movie ${id}`,
    imdb_id: `tt${id}`,
    poster_url: null,
    release_date: "2026-01-01",
    genres: ["drama"],
    runtime: 120,
    trailer_url: null,
  })
  const night = (date: string, ids: number[]) => ({ date, ids })
  const empty: data.Data = { rankings: [], catalog: {}, scores: {} }

  it("adds a night and keeps movie details", () => {
    let d = data.addNight(empty, "2026-11-22", [movie(1), movie(2)], {
      1: 80,
      2: 70,
    })
    d = data.addNight(d, "2026-11-23", [movie(2), movie(3)], { 2: 75, 3: 60 })

    assert.deepEqual(d.rankings, [
      night("2026-11-22", [1, 2]),
      night("2026-11-23", [2, 3]),
    ])
    assert.deepEqual(Object.keys(d.catalog), ["1", "2", "3"])
    assert.deepEqual(d.scores, { 2: 75, 3: 60 })
    data.validate(d)
  })

  it("replaces the night on a rerun", () => {
    let d = data.addNight(empty, "2026-11-23", [movie(1)], {})
    d = data.addNight(d, "2026-11-23", [movie(2)], {})
    assert.deepEqual(d.rankings, [night("2026-11-23", [2])])
  })

  it("lists a night in Steven Lu's format", () => {
    const d = data.addNight(empty, "2026-11-23", [movie(2), movie(1)], {})
    const list = data.toList(d.rankings[0]!.ids, d.catalog)
    validateList("best-pictures-20261123.json", list, { requireImdbId: true })
    assert.deepEqual(list[0], {
      title: "Movie 2",
      tmdb_id: 2,
      imdb_id: "tt2",
      poster_url: null,
      genres: ["drama"],
    })
    assert.equal(
      data.datedFilename("2026-11-23"),
      "best-pictures-20261123.json"
    )
  })

  it("rejects bad data", () => {
    const catalog = {
      1: {
        title: "A",
        imdb_id: "tt1",
        poster_url: null,
        release_date: null,
        genres: [],
        runtime: null,
        trailer_url: null,
      },
    }
    const bad = (d: Partial<data.Data>) => ({ ...empty, ...d })
    assert.throws(
      () =>
        data.validate(
          bad({
            rankings: [night("2026-03-02", [1]), night("2026-03-01", [1, 1])],
            catalog,
          })
        ),
      /out of order/
    )
    assert.throws(
      () => data.validate(bad({ rankings: [night("2026-03-01", [7])] })),
      /no movie details/
    )
    assert.throws(
      () => data.validate(bad({ scores: { 1: "high" as unknown as number } })),
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

  it("keeps the last score of movies that left the pool", () => {
    assert.deepEqual(standingScores(movies([1]), { 1: 50 }, { 1: 50, 9: 99 }), {
      1: 50,
      9: 99,
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

describe("year lists", () => {
  const movie = (release_date: string | null) => ({
    title: "M",
    imdb_id: "tt1",
    poster_url: null,
    release_date,
    genres: [],
    runtime: null,
    trailer_url: null,
  })
  const catalog = {
    1: movie("2025-12-20"),
    2: movie("2026-03-01"),
    3: movie("2026-11-01"),
    4: movie(null),
  }
  const lu = (date: string, ids: number[]) => ({
    date,
    ids,
    source: "stevenlu" as const,
  })

  it("lists a year's releases over their whole run, by points before scoring began", () => {
    const rankings = [
      lu("2025-12-30", [1]),
      lu("2026-01-05", [1, 2]),
      lu("2026-01-06", [2, 1]),
      lu("2026-01-07", [2, 4]),
    ]
    assert.deepEqual(yearList(rankings, catalog, {}, 2025), [1])
    // 4 has no release date, so it counts in the year it was first ranked
    assert.deepEqual(yearList(rankings, catalog, {}, 2026), [2, 4])
  })

  it("ranks by standing score from the first year this site scored", () => {
    const rankings = [
      lu("2026-03-02", [2]),
      { date: "2026-11-24", ids: [3, 2] },
    ]
    assert.deepEqual(
      yearList(rankings, catalog, { 2: 70, 3: 90 }, 2026),
      [3, 2]
    )
  })

  it("has a list for every year up to the latest night's", () => {
    const years = listYears([lu("2026-01-01", [1])])
    assert.equal(years[0], 2019)
    assert.equal(years.at(-1), 2026)
  })
})
