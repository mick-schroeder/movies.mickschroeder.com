const _ = require('lodash')
const tmdb = require('./lib/tmdb')
const mdblist = require('./lib/mdblist')
const anthropic = require('./lib/anthropic')
const config = require('./config')

// The published v1 format (see lib/validate.js)
const LIST_FIELDS = ['title', 'tmdb_id', 'imdb_id', 'poster_url', 'genres']

const addTmdbDetails = async function (movies) {
  for (const movie of movies) {
    const tmdbMovie = await tmdb.getMovie(movie.id)
    _.assign(movie, {
      tmdb_id: tmdbMovie.id,
      imdb_id: tmdbMovie.imdb_id,
      revenue: tmdbMovie.revenue === 0 ? null : tmdbMovie.revenue,
      genres: _.map(tmdbMovie.genres, genre => _.snakeCase(genre.name).toLowerCase())
    })
  }
  return movies
}

const addRatings = async function (movies) {
  const ratings = await mdblist(_.map(movies, 'tmdb_id'))
  return movies.map(movie => _.assign(movie, ratings[movie.tmdb_id]))
}

const logger = function (movies) {
  console.table(movies, [
    'id',
    'imdb_id',
    'title',
    'release_date',
    'metacritic_score',
    'imdb_rating',
    'imdb_votes',
    'rt_score',
    'rt_audience_score',
    'letterboxd_rating',
    'letterboxd_votes',
    'vote_count',
    'revenue'
  ])
}

// Every movie released in the last DAYS_BACK days, with details and ratings
const getMovies = async function () {
  const movies = _.uniqBy(await tmdb.getMovies(), 'id')
  await addTmdbDetails(movies)
  await addRatings(movies)
  logger(movies)
  return movies
}

// Each movie's standing score: a moving average of its nightly AI scores, so one noisy
// night moves it a little and a real change shows within a week or so.
// A new movie starts at tonight's score; a movie the AI skipped tonight keeps its standing.
const standingScores = function (movies, tonight, previous) {
  const scores = {}
  for (const { id } of movies) {
    const before = previous[id]
    const now = tonight[id]
    const score = _.isNil(before) ? now : _.isNil(now) ? before : config.SMOOTHING * now + (1 - config.SMOOTHING) * before
    if (!_.isNil(score)) scores[id] = Math.round(score * 10) / 10
  }
  return scores
}

// Tonight's standings. `previousScores` is last night's { [tmdb_id]: standing score }.
// Returns { ranked: LIST_SIZE full movie objects, best first, scores: every eligible movie's standing score }.
const rankMovies = async function (allMovies, previousScores = {}) {
  // Only score movies enough people have rated, so the ratings have settled.
  // movies.json requires an imdb_id (consumers match on it), so skip movies without one.
  const movies = _.filter(allMovies, movie => movie.imdb_id && _.get(movie, 'vote_count', 0) >= config.MIN_VOTES)
  console.log({ candidates: allMovies.length, with_min_votes: movies.length, min_votes: config.MIN_VOTES })

  if (movies.length < config.LIST_SIZE) {
    throw new Error(`Only ${movies.length} movies have ${config.MIN_VOTES} or more votes, need ${config.LIST_SIZE}. Lower MIN_VOTES or LIST_SIZE.`)
  }

  // Only what the prompt describes, and no empty fields, to keep the request small
  const moviesData = movies.map(movie => _.omitBy(_.pick(movie, [
    'id',
    'title',
    'release_date',
    'genres',
    'revenue',
    'rt_audience_score',
    'imdb_rating',
    'imdb_votes',
    'letterboxd_rating',
    'letterboxd_votes',
    'rt_score',
    'metacritic_score'
  ]), _.isNil))

  const tonight = await anthropic.scoreMovies(moviesData)
  return pickTop(movies, standingScores(movies, tonight, previousScores))
}

// The LIST_SIZE movies with the highest standing scores. Movies with no score are left out,
// so if the AI scored too few, the size check in bin/build.js fails the run.
const pickTop = function (movies, scores) {
  const ranked = _.chain(movies)
    .filter(movie => !_.isNil(scores[movie.id]))
    .orderBy(movie => scores[movie.id], 'desc')
    .take(config.LIST_SIZE)
    .value()
  return { ranked, scores }
}

const toList = movies => movies.map(movie => _.pick(movie, LIST_FIELDS))

module.exports = { getMovies, rankMovies, standingScores, pickTop, toList }
