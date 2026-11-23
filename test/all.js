/* eslint-env mocha */
const expect = require('must')
const Index = require('../index')
const mdblist = require('../lib/mdblist')
const tmdb = require('../lib/tmdb')

describe('all', function () {
  const IMDB_ID = 'tt11564570'
  const TMDB_ID = 661374
  const MOVIE_TITLE = 'Glass Onion: A Knives Out Mystery'

  it('should get mdblist ratings', async function () {
    const results = (await mdblist([TMDB_ID]))[TMDB_ID]
    expect(results.imdb_rating).gt(1)
    expect(results.imdb_votes).gt(1000)
    expect(results.rt_score).gt(1)
    expect(results.metacritic_score).gt(1)
  })

  it('should get tmdb movie', async function () {
    const movie = await tmdb.searchMovie(MOVIE_TITLE)
    expect(movie.id).to.equal(TMDB_ID)
    expect(movie.popularity).gt(1)
    expect(movie.release_date).to.be.string()
  })

  it('should get tmdb id', async function () {
    const movie = await tmdb.getMovie(TMDB_ID)
    expect(movie.imdb_id).to.equal(IMDB_ID)
  })

  it('should get me a list of movies', async function () {
    this.timeout(60000)
    const listBuilder = new Index()
    const movies = await listBuilder.filter()

    expect(movies.length).gt(0)
    expect(movies[0]).must.have.keys([
      'title',
      'imdb_id',
      'tmdb_id',
      'poster_url',
      'genres'
    ])
    expect(movies[0].title).to.be.string()
    // Both can be null in the unfiltered list
    expect(movies[0].imdb_id === null || typeof movies[0].imdb_id === 'string').to.be.true()
    expect(movies[0].poster_url === null || typeof movies[0].poster_url === 'string').to.be.true()
    expect(movies[0].genres).to.be.array()
  })
})
