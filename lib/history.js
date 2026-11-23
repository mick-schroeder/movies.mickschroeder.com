const _ = require('lodash')
const config = require('../config')

// Rank history, one file per calendar year (ranks-YYYY.json):
// {
//   year: 2026,
//   days: [{ date: '2026-11-23', ids: [tmdb_id, ...] }],   // best first, oldest day first
//   movies: { [tmdb_id]: { title, imdb_id, poster_url, release_date } },
//   scores: { [tmdb_id]: standing score }   // after the latest night; see standingScores in index.js
// }

const filename = year => `ranks-${year}.json`

const empty = year => ({ year, days: [], movies: {}, scores: {} })

// Downloads a year's history from the live site. A missing file (CloudFront
// answers 403 or 404) returns null only when `allowMissing` is set; anything
// else throws, so a bad download can't replace a year of history with nothing.
const load = async function (year, { allowMissing = false } = {}) {
  const url = `${config.SITE_URL}/${filename(year)}`
  const resp = await fetch(url)

  if (resp.ok) {
    return resp.json()
  }

  if ([403, 404].includes(resp.status) && allowMissing) {
    return null
  }

  throw new Error(`${url} responded with ${resp.status}`)
}

// Records `movies` (best first) as the ranking for `date`, and tonight's standing scores.
// A rerun on the same date replaces it.
const addDay = function (history, date, movies, scores) {
  const days = _.reject(history.days, { date })
  days.push({ date, ids: _.map(movies, 'tmdb_id') })

  const movieInfo = _.mapValues(_.keyBy(movies, 'tmdb_id'), movie => _.pick(movie, ['title', 'imdb_id', 'poster_url', 'release_date']))

  return {
    year: history.year,
    days: _.sortBy(days, 'date'),
    movies: { ...history.movies, ...movieInfo },
    scores
  }
}

// Throws if the history isn't safe to publish
const validate = function (history) {
  const name = filename(_.get(history, 'year'))
  const errors = []

  if (!_.isInteger(history.year)) errors.push('has no year')
  if (!_.isArray(history.days)) errors.push('days is not an array')
  if (!_.isPlainObject(history.movies)) errors.push('movies is not an object')
  if (!_.isPlainObject(history.scores) || !_.every(history.scores, _.isFinite)) errors.push('scores is not an object of numbers')

  _.forEach(history.days, function (day, i) {
    if (!_.startsWith(day.date, `${history.year}-`)) errors.push(`day ${i} has date ${day.date} outside ${history.year}`)
    if (i > 0 && day.date <= history.days[i - 1].date) errors.push(`day ${i} (${day.date}) is out of order`)
    if (!_.isArray(day.ids) || !day.ids.length || day.ids.length > config.LIST_SIZE) errors.push(`${day.date} has a bad ids list`)
    if (_.uniq(day.ids).length !== _.size(day.ids)) errors.push(`${day.date} repeats an id`)

    _.forEach(day.ids, function (id) {
      if (!_.isInteger(id)) errors.push(`${day.date} has a bad id: ${JSON.stringify(id)}`)
      else if (!_.get(history.movies, [id, 'title'])) errors.push(`${day.date} has id ${id} with no movie details`)
    })
  })

  if (errors.length) {
    throw new Error(`${name} failed validation:\n  ${_.uniq(errors).join('\n  ')}`)
  }
}

module.exports = { filename, empty, load, addDay, validate }
