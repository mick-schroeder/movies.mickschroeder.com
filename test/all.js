/* eslint-env mocha */
const expect = require('must')
const mdblist = require('../lib/mdblist')
const tmdb = require('../lib/tmdb')
const history = require('../lib/history')
const { standingScores, pickTop } = require('../index')
const _ = require('lodash')

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
})

describe('history', function () {
  const movie = (id, title = `Movie ${id}`) => ({ tmdb_id: id, title, imdb_id: `tt${id}`, poster_url: null, release_date: '2026-01-01' })
  const day = (date, ids) => ({ date, ids })

  it('adds a day and keeps movie details', function () {
    let h = history.addDay(history.empty(2026), '2026-11-22', [movie(1), movie(2)], { 1: 80, 2: 70 })
    h = history.addDay(h, '2026-11-23', [movie(2), movie(3)], { 2: 75, 3: 60 })

    expect(h.days).to.eql([day('2026-11-22', [1, 2]), day('2026-11-23', [2, 3])])
    expect(Object.keys(h.movies)).to.eql(['1', '2', '3'])
    expect(h.scores).to.eql({ 2: 75, 3: 60 })
    history.validate(h)
  })

  it('replaces the day on a rerun', function () {
    let h = history.addDay(history.empty(2026), '2026-11-23', [movie(1)], {})
    h = history.addDay(h, '2026-11-23', [movie(2)], {})
    expect(h.days).to.eql([day('2026-11-23', [2])])
  })

  it('rejects a bad history', function () {
    const h = { year: 2026, days: [day('2026-03-02', [1]), day('2026-03-01', [1, 1])], movies: { 1: { title: 'A' } }, scores: {} }
    expect(() => history.validate(h)).to.throw(/out of order/)
    expect(() => history.validate({ year: 2026, days: [day('2026-03-01', [7])], movies: {}, scores: {} })).to.throw(/no movie details/)
    expect(() => history.validate({ year: 2026, days: [], movies: {}, scores: { 1: 'high' } })).to.throw(/scores/)
  })
})

describe('standings', function () {
  const movies = ids => ids.map(id => ({ id }))

  it('blends tonight into the standing score', function () {
    // SMOOTHING 0.25: 0.25 * 100 + 0.75 * 60 = 70
    expect(standingScores(movies([1]), { 1: 100 }, { 1: 60 })).to.eql({ 1: 70 })
  })

  it('starts a new movie at tonight\'s score and keeps a skipped movie\'s standing', function () {
    expect(standingScores(movies([1, 2, 3]), { 1: 88 }, { 2: 64.5 })).to.eql({ 1: 88, 2: 64.5 })
  })

  it('drops movies that left the pool', function () {
    expect(standingScores(movies([1]), { 1: 50 }, { 1: 50, 9: 99 })).to.eql({ 1: 50 })
  })

  it('takes the top LIST_SIZE by standing score, best first', function () {
    const all = movies(_.range(1, 31))
    const scores = _.fromPairs(all.map(m => [m.id, m.id]))
    const { ranked } = pickTop(all, scores)
    expect(_.map(ranked, 'id')).to.eql(_.range(30, 10, -1))
  })
})
