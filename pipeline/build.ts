// Writes tonight's data into ./public, where `astro build` publishes it:
//   best-pictures.json            tonight's standings (Steven Lu's format)
//   best-pictures-YYYYMMDD.json   the same list, kept under tonight's date
//   data/*.json                   the rankings, movie details and scores carried to tomorrow
//
// Everything is checked before anything is written, so a bad run
// leaves no output and the live site keeps yesterday's files.
//
// Usage:
//   pnpm build:data                  nightly build (needs TMDB, MDBList and Anthropic keys)
//   pnpm build:data --new-history    start the data if the live site has none yet, backfilled
//                                    from Steven Lu's nightly lists, with a dated file for
//                                    each of his nights (first run only)
import { mkdirSync, writeFileSync } from "node:fs"
import config from "./config.ts"
import * as data from "./lib/data.ts"
import validateList from "./lib/validate.ts"
import { backfill } from "./lib/stevenlu.ts"
import { getMovies, rankMovies } from "./rank.ts"

const OUTPUT_DIR = new URL("../public/", import.meta.url)

const today = new Date().toISOString().slice(0, 10)

const newHistory = process.argv.includes("--new-history")
const saved = await data.load({ allowMissing: newHistory })
const backfilled = saved ? null : await backfill(today)
const previous: data.Data = saved ?? { ...backfilled!, scores: {} }
console.log({ history_nights: previous.rankings.length })

const movies = await getMovies()
const { ranked, scores } = await rankMovies(movies, previous.scores)
const updated = data.addNight(previous, today, ranked, scores)
data.validate(updated)

// Tonight's list, and on a backfill one for each of Steven Lu's nights
const nights = backfilled ? updated.rankings : updated.rankings.slice(-1)
const lists = nights.map((night) => ({
  name: data.datedFilename(night.date),
  list: data.toList(night.ids, updated.catalog),
}))
for (const { name, list } of lists) {
  validateList(name, list, {
    min: 1,
    max: config.LIST_SIZE,
    requireImdbId: true,
  })
}
const tonight = lists.at(-1)!.list
validateList("best-pictures.json", tonight, {
  min: config.LIST_SIZE,
  max: config.LIST_SIZE,
  requireImdbId: true,
})

// Everything passed: write it out
const write = (name: string, value: unknown) =>
  writeFileSync(new URL(name, OUTPUT_DIR), JSON.stringify(value))

mkdirSync(new URL("data/", OUTPUT_DIR), { recursive: true })
write(data.FILES.rankings, updated.rankings)
write(data.FILES.catalog, updated.catalog)
write(data.FILES.scores, updated.scores)
for (const { name, list } of lists) write(name, list)
write("best-pictures.json", tonight)

console.log({
  movies: tonight.length,
  dated_files: lists.length,
  history_nights: updated.rankings.length,
  history_movies: Object.keys(updated.catalog).length,
})
