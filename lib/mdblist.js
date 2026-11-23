const _ = require('lodash')
const config = require('../config')

// Looks up ratings and audience size for many movies at once.
// Returns { [tmdbId]: { imdb_rating, imdb_votes, ... } } with the fields below.
module.exports = async function getRatings (tmdbIds) {
  const ratings = {}

  for (const ids of _.chunk(tmdbIds, 100)) {
    const resp = await fetch(`https://api.mdblist.com/tmdb/movie?apikey=${config.MDBLIST_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })

    if (!resp.ok) {
      throw new Error('MDBList responded with ' + resp.status + ' instead of 200')
    }

    for (const movie of await resp.json()) {
      const rating = source => _.find(movie.ratings, { source }) || {}

      ratings[_.get(movie, 'ids.tmdb')] = {
        imdb_rating: rating('imdb').value ?? null,
        imdb_votes: rating('imdb').votes ?? null,
        rt_score: rating('tomatoes').value ?? null,
        rt_audience_score: rating('popcorn').value ?? null,
        metacritic_score: rating('metacritic').value ?? null,
        letterboxd_rating: rating('letterboxd').value ?? null,
        letterboxd_votes: rating('letterboxd').votes ?? null,
        mdblist_score: movie.score ?? null
      }
    }
  }

  return ratings
}
