#!/usr/bin/env node
//
// Builds every published file into ./public:
// the JSON lists plus the static site files in ./site.
//
// Every list is checked before anything is written, so a bad run
// leaves no output and the live site keeps yesterday's files.
//
// Usage:
//   node bin/build.js                  full build (needs TMDB, MDBList and Anthropic keys)
//   node bin/build.js --skip-ranking   skip AI ranking; leaves out movies.json and the dated file (local testing only)
//
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const _ = require('lodash')
const Index = require('../index')
const config = require('../config')
const validateList = require('../lib/validate')

const ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'public')
const SITE_DIR = path.join(ROOT, 'site')

const skipRanking = process.argv.includes('--skip-ranking')

// Filtered lists. The first three groups match the original StevenLu files.
const FILTERS = [
  ..._.map([50, 60, 70, 80], score => ({ filename: `movies-metacritic-min${score}.json`, opts: { min_metacritic_score: score } })),
  ..._.map([5, 6, 7, 8], score => ({ filename: `movies-imdb-min${score}.json`, opts: { min_imdb_rating: score } })),
  ..._.map([50, 60, 70, 80], score => ({ filename: `movies-rottentomatoes-min${score}.json`, opts: { min_rt_score: score } })),
  // Added in this fork
  ..._.map([50, 60, 70, 80], score => ({ filename: `movies-rottentomatoes-audience-min${score}.json`, opts: { min_rt_audience_score: score } })),
  ..._.map([50, 60, 70, 80], score => ({ filename: `movies-mdblist-min${score}.json`, opts: { min_mdblist_score: score } }))
]

async function main () {
  const listBuilder = new Index()
  const files = []

  if (skipRanking) {
    console.warn('--skip-ranking: movies.json and the dated file will not be built')
  } else {
    // Ask the AI once; movies.json and the dated copy come from the same answer
    const ranked = await listBuilder.evaluate()
    validateList('movies.json', ranked, { min: config.LIST_SIZE, max: config.LIST_SIZE, requireImdbId: true })
    files.push({ filename: 'movies.json', movies: ranked })
    files.push({ filename: `movies-${moment.utc().format('YYYYMMDD')}.json`, movies: ranked })
  }

  const all = await listBuilder.filter()
  validateList('all-movies.json', all, { min: 10 })
  files.push({ filename: 'all-movies.json', movies: all })

  for (const { filename, opts } of FILTERS) {
    const movies = await listBuilder.filter(opts)
    validateList(filename, movies)
    files.push({ filename, movies })
  }

  // Everything passed: write it out
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
  fs.cpSync(SITE_DIR, OUTPUT_DIR, { recursive: true })

  for (const { filename, movies } of files) {
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify(movies))
    console.log({ filename, count: movies.length })
  }

  console.log(`Wrote ${files.length} lists to public/`)
}

main()
  .then(() => process.exit(0))
  .catch(function (err) {
    console.error(err)
    process.exit(1)
  })
