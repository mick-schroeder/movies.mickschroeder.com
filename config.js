const _ = require('lodash')
const dotenv = require('dotenv')

// load dotenv config vars if available
dotenv.config()

// Set from the environment (.env locally, secrets/variables in GitHub Actions)
const env = {
  TMDB_KEY: '',
  MDBLIST_KEY: '',
  ANTHROPIC_API_KEY: '',
  ANTHROPIC_MODEL: 'claude-haiku-5-5',
  // Where the build downloads earlier rank history (ranks-YYYY.json) from
  SITE_URL: 'https://movies.mickschroeder.com'
}

// Empty env vars (e.g. an unset GitHub Actions variable) fall back to the defaults
const fromEnv = _.pick(_.omitBy(process.env, value => value === ''), _.keys(env))

module.exports = {
  ...env,
  ...fromEnv,

  TMDB_POSTER_URL: 'https://image.tmdb.org/t/p/w500',
  ANTHROPIC_EFFORT: 'medium',

  // Rolling window: movies released (TMDB release date) in the last this many days
  DAYS_BACK: 365,

  // TMDB search: only movies with at least this many votes and this average (0-10)
  MIN_VOTES_ALL_LISTS: 250,
  MIN_TMDB_RATING: 3,
  // The AI only picks from movies with at least this many TMDB votes,
  // so a movie joins the standings once it has traction
  MIN_VOTES: 500,
  // movies.json: exactly this many movies
  LIST_SIZE: 20,
  // How much tonight's AI score counts toward a movie's standing score (the rest is
  // last night's standing). Lower is steadier; higher reacts faster.
  SMOOTHING: 0.25
}
