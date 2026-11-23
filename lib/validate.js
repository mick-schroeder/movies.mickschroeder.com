const _ = require('lodash')

// The v1 file format: a JSON array of these objects. Existing consumers read
// `title` and `imdb_id`, so the shape must not change.
const FIELDS = ['title', 'tmdb_id', 'imdb_id', 'poster_url', 'genres']

const checkMovie = function (movie, opts) {
  const problems = []

  if (!_.isPlainObject(movie)) {
    return ['is not an object']
  }

  const extra = _.difference(_.keys(movie), FIELDS)
  if (extra.length) problems.push(`has unexpected fields: ${extra.join(', ')}`)
  if (!_.isString(movie.title) || !movie.title) problems.push('has no title')
  if (!_.isInteger(movie.tmdb_id)) problems.push('has no tmdb_id')
  if (!_.isArray(movie.genres)) problems.push('genres is not an array')
  if (!_.isNil(movie.poster_url) && !_.isString(movie.poster_url)) problems.push('poster_url is not a string')

  const hasImdbId = _.isString(movie.imdb_id) && /^tt\d+$/.test(movie.imdb_id)
  if (opts.requireImdbId ? !hasImdbId : !(hasImdbId || _.isNil(movie.imdb_id))) {
    problems.push(`has a bad imdb_id: ${JSON.stringify(movie.imdb_id)}`)
  }

  return problems
}

// Throws if a list isn't safe to publish. Nothing is written or uploaded when this fails.
module.exports = function validateList (filename, movies, opts = {}) {
  _.defaults(opts, { min: 0, max: Infinity, requireImdbId: false })

  if (!_.isArray(movies)) {
    throw new Error(`${filename}: expected an array`)
  }

  if (movies.length < opts.min || movies.length > opts.max) {
    throw new Error(`${filename}: has ${movies.length} movies, expected ${opts.min} to ${opts.max}`)
  }

  const errors = []
  movies.forEach(function (movie, i) {
    for (const problem of checkMovie(movie, opts)) {
      errors.push(`${filename}[${i}] (${_.get(movie, 'title', '?')}) ${problem}`)
    }
  })

  if (errors.length) {
    throw new Error(`${filename} failed validation:\n  ${errors.join('\n  ')}`)
  }
}
