const _ = require('lodash')
const dotenv = require('dotenv')

// load dotenv config vars if available
dotenv.config()

// Set from the environment (.env locally, secrets/variables in GitHub Actions)
const env = {
  TMDB_KEY: '',
  MDBLIST_KEY: '',
  ANTHROPIC_API_KEY: '',
  ANTHROPIC_MODEL: 'claude-sonnet-5-5'
}

// Empty env vars (e.g. an unset GitHub Actions variable) fall back to the defaults
const fromEnv = _.pick(_.omitBy(process.env, value => value === ''), _.keys(env))

module.exports = {
  ...env,
  ...fromEnv,

  TMDB_POSTER_URL: 'https://image.tmdb.org/t/p/w500',
  ANTHROPIC_EFFORT: 'medium',

  // Which movies count as recent, measured from the day a movie is out at home
  // (its first US digital or disc release; see getAvailableDate in index.js).
  // Same as Radarr's Availability Delay (Settings → Indexers): days before (negative)
  // or after (positive) the available date. -14 lists a movie 14 days before it's out
  AVAILABILITY_DELAY: -14,
  // Keep it eligible for this many days after it's out
  DAYS_AFTER_AVAILABLE: 180,

  // Every list: only movies with at least this many TMDB votes
  MIN_VOTES_ALL_LISTS: 250,
  // Every list: only movies with a TMDB average of at least this (0-10)
  MIN_TMDB_RATING: 3,
  // movies.json: the AI only picks from movies with at least this many TMDB votes,
  // so picks are made once ratings have settled
  MIN_VOTES: 500,
  // movies.json: exactly this many movies
  LIST_SIZE: 20
}
