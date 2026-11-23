const { setTimeout: sleep } = require('timers/promises')
const _ = require('lodash')
const moment = require('moment')
const config = require('../config')

// On a 429, waits for Retry-After (1s if missing) and tries again, up to `retries` times
const makeRequest = async function (url, data, retries = 3) {
  const params = new URLSearchParams({ api_key: config.TMDB_KEY, ...data })
  const resp = await fetch(`https://api.themoviedb.org/3${url}?${params}`)

  if (resp.status === 429 && retries > 0) {
    await sleep((Number(resp.headers.get('retry-after')) || 1) * 1100)
    return makeRequest(url, data, retries - 1)
  }

  if (resp.status !== 200) {
    throw new Error('TMDB responded with ' + resp.status + ' instead of 200')
  }

  return resp.json()
}

const formatMovie = function (movie) {
  const details = _.pick(movie, [
    'id',
    'title',
    'release_date',
    'popularity',
    'vote_average',
    'vote_count',
    'poster_path'
  ])
  details.poster_url = details.poster_path ? config.TMDB_POSTER_URL + details.poster_path : null
  return details
}

// A movie can reach digital or disc long after it's in theaters, so search far
// enough back to find every movie that came out at home in the last
// DAYS_AFTER_AVAILABLE days. index.js then keeps only the ones in that window.
const MAX_DAYS_THEATERS_TO_HOME = 180
const SEARCH_DAYS_BACK = config.DAYS_AFTER_AVAILABLE + MAX_DAYS_THEATERS_TO_HOME

const getMovies = function (page) {
  return makeRequest('/discover/movie', {
    sort_by: 'popularity.desc',
    'vote_count.gte': config.MIN_VOTES_ALL_LISTS,
    'vote_average.gte': config.MIN_TMDB_RATING,
    page: page || 1,
    language: 'en-US',
    region: 'US',
    'release_date.gte': moment().subtract(SEARCH_DAYS_BACK, 'days').format('YYYY-MM-DD'),
    'release_date.lte': moment().format('YYYY-MM-DD')
  })
}

module.exports.getMovies = async function () {
  const firstResponse = await getMovies()
  let allMovies = [...firstResponse.results]

  // Fetch remaining pages
  const remainingPages = _.range(2, firstResponse.total_pages + 1)
  for (const page of remainingPages) {
    const response = await getMovies(page)
    allMovies.push(...response.results)
  }

  // Clean and format movies
  allMovies = _.compact(allMovies)
  return allMovies.map(movie => formatMovie(movie))
}

module.exports.getMovie = function (id) {
  return makeRequest('/movie/' + id, {
    append_to_response: 'release_dates'
  })
}

module.exports.searchMovie = function (title, year) {
  const query = {
    query: title.replace(/[^\w\s]/gi, '')
  }

  if (year) {
    query.year = year
  }

  return makeRequest('/search/movie', query)
    .then(function (results) {
      return _.first(results.results)
    })
    .then(function (movie) {
      return formatMovie(movie)
    })
}
