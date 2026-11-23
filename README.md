# AI Curated Recent Movies

Recently released movies, selected and ranked by our AI editor, refreshed every night.

Each night, AI picks the 20 movies it would recommend to a friend from the ones
that came out in the last 6 months. Audience ratings count for more than critics.

This is a fork of [sjlu/popular-movies](https://github.com/sjlu/popular-movies)
by Steven Lu. The files use **the same names and the same JSON format**, so anything
that read the StevenLu lists can point at these instead.

## Usage

```
https://movies.mickschroeder.com/movies.json
```

- Updated nightly. Poll at most once a day.

### Radarr

Add an import list of type **StevenLu Custom** and set the URL to
`https://movies.mickschroeder.com/movies.json` (or any file below).

## Files

Every file is a JSON array of:

```json
{
  "title": "The Quiet Man",
  "tmdb_id": 3109,
  "imdb_id": "tt0045061",
  "poster_url": "https://image.tmdb.org/t/p/w500/u3B1hVKHE56yBRoxF3Nk9uxHdYN.jpg",
  "genres": ["romance", "comedy", "drama"]
}
```

| File | Contents |
| -- | -- |
| [movies.json](https://movies.mickschroeder.com/movies.json) | 20 movies ranked by AI, best recommendation first |
| `movies-YYYYMMDD.json` | A dated copy of `movies.json` for each day since this site started |
| [all-movies.json](https://movies.mickschroeder.com/all-movies.json) | Every movie the ranking chose from, unranked |
| [movies-metacritic-min50.json](https://movies.mickschroeder.com/movies-metacritic-min50.json) | Metacritic score of 50 or more |
| [movies-metacritic-min60.json](https://movies.mickschroeder.com/movies-metacritic-min60.json) | Metacritic score of 60 or more |
| [movies-metacritic-min70.json](https://movies.mickschroeder.com/movies-metacritic-min70.json) | Metacritic score of 70 or more |
| [movies-metacritic-min80.json](https://movies.mickschroeder.com/movies-metacritic-min80.json) | Metacritic score of 80 or more |
| [movies-imdb-min5.json](https://movies.mickschroeder.com/movies-imdb-min5.json) | IMDb rating of 5 or more |
| [movies-imdb-min6.json](https://movies.mickschroeder.com/movies-imdb-min6.json) | IMDb rating of 6 or more |
| [movies-imdb-min7.json](https://movies.mickschroeder.com/movies-imdb-min7.json) | IMDb rating of 7 or more |
| [movies-imdb-min8.json](https://movies.mickschroeder.com/movies-imdb-min8.json) | IMDb rating of 8 or more |
| [movies-rottentomatoes-min50.json](https://movies.mickschroeder.com/movies-rottentomatoes-min50.json) | Rotten Tomatoes score of 50 or more |
| [movies-rottentomatoes-min60.json](https://movies.mickschroeder.com/movies-rottentomatoes-min60.json) | Rotten Tomatoes score of 60 or more |
| [movies-rottentomatoes-min70.json](https://movies.mickschroeder.com/movies-rottentomatoes-min70.json) | Rotten Tomatoes score of 70 or more |
| [movies-rottentomatoes-min80.json](https://movies.mickschroeder.com/movies-rottentomatoes-min80.json) | Rotten Tomatoes score of 80 or more |
| [movies-rottentomatoes-audience-min50.json](https://movies.mickschroeder.com/movies-rottentomatoes-audience-min50.json) | Rotten Tomatoes audience score of 50 or more |
| [movies-rottentomatoes-audience-min60.json](https://movies.mickschroeder.com/movies-rottentomatoes-audience-min60.json) | Rotten Tomatoes audience score of 60 or more |
| [movies-rottentomatoes-audience-min70.json](https://movies.mickschroeder.com/movies-rottentomatoes-audience-min70.json) | Rotten Tomatoes audience score of 70 or more |
| [movies-rottentomatoes-audience-min80.json](https://movies.mickschroeder.com/movies-rottentomatoes-audience-min80.json) | Rotten Tomatoes audience score of 80 or more |
| [movies-mdblist-min50.json](https://movies.mickschroeder.com/movies-mdblist-min50.json) | MDBList score (a blend of all ratings) of 50 or more |
| [movies-mdblist-min60.json](https://movies.mickschroeder.com/movies-mdblist-min60.json) | MDBList score (a blend of all ratings) of 60 or more |
| [movies-mdblist-min70.json](https://movies.mickschroeder.com/movies-mdblist-min70.json) | MDBList score (a blend of all ratings) of 70 or more |
| [movies-mdblist-min80.json](https://movies.mickschroeder.com/movies-mdblist-min80.json) | MDBList score (a blend of all ratings) of 80 or more |

## How it works

1. `bin/build.js` does the work:
   - Gather - Gets movies from TMDB that came out in the last 180 days. d.
   - Enrich - Adds ratings from MDBList.
   - Curate - Asks AI to pick 20 of the movies with at least 500 TMDB votes.
   - Publish - Checks every list, then writes the files and the static site (`site/`) to
     `public/`.
2. The `publish` GitHub Actions workflow runs it nightly, uploads `public/` to S3
   and refreshes CloudFront. If any check fails, nothing is uploaded and the
   previous day's files stay live.
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
(default `claude-sonnet-5-5`).

To try it without an Anthropic key, `node bin/build.js --skip-ranking` builds
everything except `movies.json` and the dated file.

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

MIT
