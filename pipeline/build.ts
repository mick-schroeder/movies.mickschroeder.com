// Writes tonight's data into ./public, where `astro build` publishes it:
// best-pictures.json (tonight's standings) and best-pictures-YYYY.json (this year's rank history).
//
// Everything is checked before anything is written, so a bad run
// leaves no output and the live site keeps yesterday's files.
//
// Usage:
//   pnpm build:data                  nightly build (needs TMDB, MDBList and Anthropic keys)
//   pnpm build:data --new-history    start the history if the live site has none yet: this year
//                                    and every past year back to FIRST_YEAR, backfilled from
//                                    Steven Lu's nightly lists (first run only; on Jan 1 a new
//                                    year starts empty without it)
import { writeFileSync } from "node:fs"
import { FIRST_YEAR } from "../src/consts.ts"
import config from "./config.ts"
import * as history from "./lib/history.ts"
import validateList from "./lib/validate.ts"
import { backfill } from "./lib/stevenlu.ts"
import { getMovies, rankMovies, toList } from "./rank.ts"

const OUTPUT_DIR = new URL("../public/", import.meta.url)

const today = new Date().toISOString().slice(0, 10)
const year = Number(today.slice(0, 4))

// This year's file is only allowed to be missing when the year just started,
// or on the very first run (--new-history), which backfills from Steven Lu's lists
const newHistory = process.argv.includes("--new-history")
const allowMissing = newHistory || today.endsWith("-01-01")
const thisYear =
  (await history.load(year, { allowMissing })) ??
  (newHistory ? await backfill(year, today) : history.empty(year))
// Past years the live site doesn't have yet, all from Steven Lu's lists
const pastYears = []
for (let y = FIRST_YEAR; newHistory && y < year; y++) {
  if (await history.load(y, { allowMissing: true })) continue
  const past = await backfill(y, `${y + 1}-01-01`)
  history.validate(past)
  pastYears.push(past)
  console.log({ backfilled: y, days: past.days.length })
}
const lastYear =
  pastYears.find((h) => h.year === year - 1) ??
  (await history.load(year - 1, { allowMissing: true }))
console.log({
  history_days: thisYear.days.length,
  last_year_days: lastYear?.days.length ?? 0,
})

// Last night's standing scores; on Jan 1 they're in last year's file
const previousScores =
  (thisYear.days.length ? thisYear.scores : lastYear?.scores) ?? {}

const movies = await getMovies()
const { ranked, scores } = await rankMovies(movies, previousScores)

const list = toList(ranked)
validateList("best-pictures.json", list, {
  min: config.LIST_SIZE,
  max: config.LIST_SIZE,
  requireImdbId: true,
})

const updated = history.addDay(thisYear, today, ranked, scores)
history.validate(updated)

// Everything passed: write it out
for (const past of pastYears) {
  writeFileSync(
    new URL(history.filename(past.year), OUTPUT_DIR),
    JSON.stringify(past)
  )
}
writeFileSync(new URL("best-pictures.json", OUTPUT_DIR), JSON.stringify(list))
writeFileSync(
  new URL(history.filename(year), OUTPUT_DIR),
  JSON.stringify(updated)
)

console.log({
  movies: list.length,
  history_days: updated.days.length,
  history_movies: Object.keys(updated.movies).length,
})
