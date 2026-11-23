const Promise = require('bluebird')
const moment = require('moment')
const _ = require('lodash')
const tmdb = require('./lib/tmdb')
const mdblist = require('./lib/mdblist')
const anthropic = require('./lib/anthropic')
const config = require('./config')

const getTmdb = function (tmdbId) {
  return tmdb.getMovie(tmdbId)
}

// The date Radarr's "Released" minimum availability treats a movie as out:
// the first US digital (type 4) or physical (type 5) release, or 90 days after
// the US theatrical release (types 2 and 3) when there's neither.
const getAvailableDate = function (tmdbMovie, fallbackReleaseDate) {
  const us = _.find(_.get(tmdbMovie, 'release_dates.results'), { iso_3166_1: 'US' })
  const firstOfType = types => _.chain(_.get(us, 'release_dates'))
    .filter(release => types.includes(release.type))
    .map(release => release.release_date.slice(0, 10))
    .min()
    .value()

  const homeRelease = firstOfType([4, 5])
  if (homeRelease) {
    return homeRelease
  }

  return moment(firstOfType([2, 3]) || fallbackReleaseDate).add(90, 'days').format('YYYY-MM-DD')
}

// Keeps movies that are recent at home: out on digital or disc within the last
// DAYS_AFTER_AVAILABLE days, or counted as available by Radarr's AVAILABILITY_DELAY.
// Re-releases of old movies drop out too: their home release is years old.
const filterRecent = function (movies) {
  const earliest = moment().subtract(config.DAYS_AFTER_AVAILABLE, 'days').format('YYYY-MM-DD')
  const latest = moment().subtract(config.AVAILABILITY_DELAY, 'days').format('YYYY-MM-DD')

  return _.filter(movies, movie => movie.available_date >= earliest && movie.available_date <= latest)
}

const getTmdbDetails = function (movies) {
  return Promise
    .resolve(movies)
    .mapSeries(function (movie) {
      return getTmdb(movie.id)
        .then(function (tmdbMovie) {
          return _.assign(movie, {
            tmdb_id: tmdbMovie.id,
            imdb_id: tmdbMovie.imdb_id,
            available_date: getAvailableDate(tmdbMovie, movie.release_date),
            revenue: tmdbMovie.revenue === 0 ? null : tmdbMovie.revenue,
            genres: _.chain(tmdbMovie.genres)
              .map('name')
              .map(name => _.snakeCase(name).toLowerCase())
              .value()
          })
        })
    })
}

const getRatings = async function (movies) {
  const ratings = await mdblist(_.map(movies, 'tmdb_id'))

  return movies.map(function (movie) {
    return _.assign(movie, ratings[movie.tmdb_id])
  })
}

const evaluateMovies = async function (allMovies) {
  // Only pick movies enough people have rated, so the ratings have settled.
  // movies.json requires an imdb_id (Radarr matches on it), so skip movies without one.
  const movies = _.filter(allMovies, movie => movie.imdb_id && _.get(movie, 'vote_count', 0) >= config.MIN_VOTES)
  console.log({ candidates: allMovies.length, with_min_votes: movies.length, min_votes: config.MIN_VOTES })

  if (movies.length < config.LIST_SIZE) {
    throw new Error(`Only ${movies.length} movies have ${config.MIN_VOTES} or more votes, need ${config.LIST_SIZE}. Lower MIN_VOTES or LIST_SIZE.`)
  }

  // Only what the prompt describes, and no empty fields, to keep the request small
  const moviesData = movies.map(function (movie) {
    return _.omitBy(_.pick(movie, [
      'id',
      'title',
      'genres',
      'revenue',
      'rt_audience_score',
      'imdb_rating',
      'imdb_votes',
      'letterboxd_rating',
      'letterboxd_votes',
      'rt_score',
      'metacritic_score'
    ]), _.isNil)
  })

  const ids = await anthropic.rankMovies(moviesData, config.LIST_SIZE)

  // Drop ids that weren't in the input, so an invented id can't become an empty entry.
  // If that leaves too few, the size check in bin/build.js fails the run.
  const byId = _.keyBy(movies, 'id')
  return _.chain(ids)
    .uniq()
    .map(id => byId[id])
    .compact()
    .take(config.LIST_SIZE)
    .value()
}

const sanatizeForResponse = function (movies) {
  return Promise
    .resolve(movies)
    .map(function (movie) {
      return _.pick(movie, [
        'title',
        'tmdb_id',
        'imdb_id',
        'poster_url',
        'genres'
      ])
    })
}

const filterByMinValue = function (key, value) {
  return function (movies) {
    // No minimum asked for: keep every movie, including ones with no score
    if (_.isNil(value)) {
      return movies
    }

    return _.filter(movies, function (movie) {
      return _.get(movie, key, 0) >= value
    })
  }
}

const logger = function (movies) {
  console.table(movies, [
    'id',
    'imdb_id',
    'tmdb_id',
    'title',
    'release_date',
    'available_date',
    'metacritic_score',
    'imdb_rating',
    'imdb_votes',
    'rt_score',
    'rt_audience_score',
    'letterboxd_rating',
    'letterboxd_votes',
    'mdblist_score',
    'popularity',
    'vote_average',
    'vote_count',
    'genres',
    'revenue'
  ])
}

const deduplicateMovies = function (movies) {
  return _.uniqBy(movies, 'tmdb_id')
}

module.exports = (function () {
  //
  // Class builder functions to help cache content but be
  // able to filter after the fact with options
  //
  let allMovies = null

  const getMovies = function () {
    if (allMovies) {
      return allMovies
    }

    return Promise
      .resolve(tmdb.getMovies())
      .then(getTmdbDetails)
      .then(filterRecent)
      .then(getRatings)
      .tap(logger)
      .tap(function (movies) {
        allMovies = movies
      })
  }

  const ListBuilder = function () {}

  ListBuilder.prototype.filter = function (opts = {}) {
    return Promise
      .resolve(getMovies())
      .then(deduplicateMovies)
      .then(filterByMinValue('metacritic_score', opts.min_metacritic_score))
      .then(filterByMinValue('rt_score', opts.min_rt_score))
      .then(filterByMinValue('rt_audience_score', opts.min_rt_audience_score))
      .then(filterByMinValue('mdblist_score', opts.min_mdblist_score))
      .then(filterByMinValue('imdb_rating', opts.min_imdb_rating))
      .then(sanatizeForResponse)
  }

  ListBuilder.prototype.evaluate = function () {
    return Promise
      .resolve(getMovies())
      .then(deduplicateMovies)
      .then(evaluateMovies)
      .then(sanatizeForResponse)
  }

  return ListBuilder
})()
