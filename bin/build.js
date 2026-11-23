#!/usr/bin/env node
//
// Builds every published file into ./public:
// movies.json (tonight's standings), ranks-YYYY.json (this year's rank history)
// and the static site files in ./site.
//
// Everything is checked before anything is written, so a bad run
// leaves no output and the live site keeps yesterday's files.
//
// Usage:
//   node bin/build.js                 nightly build (needs TMDB, MDBList and Anthropic keys)
//   node bin/build.js --new-history   start this year's history if the live site has none yet
//                                     (first run; otherwise only allowed on Jan 1)
//
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const { getMovies, rankMovies, toList } = require('../index')
const config = require('../config')
const validateList = require('../lib/validate')
const history = require('../lib/history')

const ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'public')
const SITE_DIR = path.join(ROOT, 'site')

const newHistory = process.argv.includes('--new-history')

async function main () {
  const now = moment.utc()
  const today = now.format('YYYY-MM-DD')
  const year = now.year()

  // This year's file is only allowed to be missing when the year just started
  const allowMissing = newHistory || today.endsWith('-01-01')
  const thisYear = await history.load(year, { allowMissing }) || history.empty(year)
  const lastYear = await history.load(year - 1, { allowMissing: true })
  console.log({ history_days: thisYear.days.length, last_year_days: lastYear ? lastYear.days.length : 0 })

  // Last night's standing scores; on Jan 1 they're in last year's file
  const previousScores = (thisYear.days.length ? thisYear.scores : lastYear && lastYear.scores) || {}

  const movies = await getMovies()
  const { ranked, scores } = await rankMovies(movies, previousScores)

  const list = toList(ranked)
  validateList('movies.json', list, { min: config.LIST_SIZE, max: config.LIST_SIZE, requireImdbId: true })

  const updated = history.addDay(thisYear, today, ranked, scores)
  history.validate(updated)

  // Everything passed: write it out
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
  fs.cpSync(SITE_DIR, OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT_DIR, 'movies.json'), JSON.stringify(list))
  fs.writeFileSync(path.join(OUTPUT_DIR, history.filename(year)), JSON.stringify(updated))

  console.log({ movies: list.length, history_days: updated.days.length, history_movies: Object.keys(updated.movies).length })
}

main()
  .then(() => process.exit(0))
  .catch(function (err) {
    console.error(err)
    process.exit(1)
  })
