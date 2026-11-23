# Movie Standings

The year's best movies, ranked by AI every night, with every movie's rise and fall charted across the year.

Each night, AI scores every movie released in the last 365 days on how strongly it
would recommend it to a friend. A movie's standing score is a running average of
those nightly scores, so the standings move steadily instead of reshuffling, and a
movie can hold its spot all year. The top 20 are the standings. Every night's ranks
are saved, and the site charts each movie's rise and fall across the year.

This started as a fork of [sjlu/popular-movies](https://github.com/sjlu/popular-movies)
by Steven Lu. `movies.json` keeps **the same JSON format**, so anything that read the
StevenLu lists can point at it.

## Usage

```
https://movies.mickschroeder.com/movies.json
```

- Updated nightly. Poll at most once a day.

## Files

| File | Contents |
| -- | -- |
| [movies.json](https://movies.mickschroeder.com/movies.json) | Tonight's standings: 20 movies, best first |
| `ranks-YYYY.json` | Every night's standings for one calendar year, e.g. [ranks-2026.json](https://movies.mickschroeder.com/ranks-2026.json) |

`movies.json` is a JSON array of:

```json
{
  "title": "The Quiet Man",
  "tmdb_id": 3109,
  "imdb_id": "tt0045061",
  "poster_url": "https://image.tmdb.org/t/p/w500/u3B1hVKHE56yBRoxF3Nk9uxHdYN.jpg",
  "genres": ["romance", "comedy", "drama"]
}
```

`ranks-YYYY.json` holds the TMDB ids for each night, best first, the details of every movie that has appeared, and each eligible movie's standing score after the latest night:

```json
{
  "year": 2026,
  "days": [{ "date": "2026-11-23", "ids": [3109, 550, ...] }],
  "movies": { "3109": { "title": "The Quiet Man", "imdb_id": "tt0045061", "poster_url": "...", "release_date": "1952-07-21" } },
  "scores": { "3109": 87.5 }
}
```

Dates are UTC. The eligibility window is rolling (the last 365 days), so in January a year's file still includes movies from late the year before.

## How it works

1. `bin/build.js` does the work:
   - History - Downloads this year's and last year's `ranks-YYYY.json` from the live site.
   - Gather - Gets movies from TMDB first released in the last 365 days (re-releases of older movies are left out).
   - Enrich - Adds ratings from MDBList.
   - Score - The AI scores every movie with at least 500 TMDB votes from 0 to 100.
   - Rank - Each movie's standing score becomes 25% tonight's score and 75% last night's
     standing (`SMOOTHING` in `config.js`); a new movie starts at its first score. The top 20
     are tonight's standings.
   - Publish - Checks `movies.json` and the history, then writes them and the static site
     (`site/`) to `public/`.
2. The `publish` GitHub Actions workflow runs it nightly, uploads `public/` to S3
   and refreshes CloudFront. If any check fails, nothing is uploaded and the
   previous day's files stay live. If this year's history can't be downloaded the
   build fails rather than start over, except on Jan 1. For the very first run, start the
   workflow by hand with **new_history** checked (locally: `node bin/build.js --new-history`).
3. The ranking instructions are in [`prompts/rank-movies.md`](prompts/rank-movies.md).

AWS setup is in [`infra/README.md`](infra/README.md).

## Develop

Requires Node.js 24. Create a `.env` file:

```
TMDB_KEY=
MDBLIST_KEY=
ANTHROPIC_API_KEY=
```

Then:

```bash
npm install
```

```bash
npm run build
```

### Settings

The date window, vote minimums, list size and model effort are constants in
`config.js`; edit them there. The model can be changed without a code change
by setting `ANTHROPIC_MODEL` in `.env` or as a GitHub Actions variable
(default `claude-haiku-5-5`).

Set `SITE_URL` to download history from somewhere else, e.g. a local
`npx serve` of a folder with test `ranks-YYYY.json` files.

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

MIT
