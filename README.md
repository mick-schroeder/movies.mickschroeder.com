# Best Pictures

The best movies of the past year, ranked by our AI editor.

This started as a fork of [sjlu/popular-movies](https://github.com/sjlu/popular-movies)
by Steven Lu. `best-pictures.json` keeps **the same JSON format**, so anything that read the
StevenLu lists can point at it.

## Usage

```
https://movies.mickschroeder.com/best-pictures.json
```

- Updated nightly. Poll at most once a day.

## Files

| File                                                                      | Contents                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [best-pictures.json](https://movies.mickschroeder.com/best-pictures.json) | The current standings: 25 movies, best first                                 |
| `best-pictures-YYYYMMDD.json`                                             | One night's standings in the same format, e.g. `best-pictures-20261123.json` |

`best-pictures.json` is a JSON array of:

```json
{
  "title": "The Quiet Man",
  "tmdb_id": 3109,
  "imdb_id": "tt0045061",
  "poster_url": "https://image.tmdb.org/t/p/w500/u3B1hVKHE56yBRoxF3Nk9uxHdYN.jpg",
  "genres": ["romance", "comedy", "drama"]
}
```

`best-pictures-YYYYMMDD.json` is each night's `best-pictures.json`, kept under its date (UTC) like Steven Lu's `movies-YYYYMMDD.json`. Both formats are the contract and won't change.

Every night from Dec 2, 2019, until this site started ranking its own is backfilled from [Steven Lu's dated lists](https://github.com/sjlu/popular-movies#usage) (15 recent movies, his order; lists before 2023 have only IMDb ids, so TMDB ids are looked up). Nights missing from his archive (for example Oct 25, 2025–Jan 21, 2026 and Mar 11–May 24, 2026) have no file. The backfill runs once, on the first run with `--new-history`.

### Site data

The site keeps its own working data under `data/`. It isn't a contract and may change; use the files above instead.

| File                 | Contents                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `data/rankings.json` | Every night's TMDB ids, best first, oldest night first; Steven Lu's nights have `"source": "stevenlu"`                 |
| `data/movies.json`   | Every movie that has been in the standings, by TMDB id: title, IMDb id, poster, release date, genres, runtime, trailer |
| `data/scores.json`   | Each eligible movie's standing score after the latest night, which tomorrow's ranking starts from                      |

## How it works

The repo is one Astro + shadcn site with the data pipeline as a build step:

```
pipeline/   nightly data: TMDB + MDBList + AI scoring -> public/best-pictures*.json, public/data/
src/        the site (Astro pages, React islands, shadcn components)
public/     static files copied as-is (llms.txt, robots.txt, and the latest data once built)
infra/      AWS stack: S3 + CloudFront + GitHub OIDC role
```

1. `pnpm build:data` ([`pipeline/build.ts`](pipeline/build.ts)) does the work:
   - History - Downloads `data/` (rankings, movie details, scores) from the live site.
   - Gather - Gets movies from TMDB first released in the last 365 days (re-releases of older movies are left out).
   - Enrich - Adds ratings from MDBList.
   - Score - The AI scores every movie with at least 500 TMDB votes from 0 to 100.
   - Rank - Each movie's standing score becomes 25% tonight's score and 75% last night's
     standing (`SMOOTHING` in `pipeline/config.ts`); a new movie starts at its first score. The top 25
     are tonight's standings.
   - Write - Checks everything, then writes `best-pictures.json`, tonight's `best-pictures-YYYYMMDD.json` and `data/` to `public/`.
2. `pnpm build` builds the site into `dist/`: the current standings (`/`), a page for each year (`/year/{year}/`), and a page for
   every movie that has been in the standings (`/title/{tmdb_id}-{title}/`): its year as a short joyplot of the movies that joined around it, its own ridge in bold
   and its release, first, best and latest nights pinned on it, plus links to TMDB, IMDb, Letterboxd, MDBList, Rotten Tomatoes, Metacritic and Trakt.
   Without `public/best-pictures.json` (local dev, CI) it uses the live file instead.
3. The `publish` GitHub Actions workflow runs both nightly, uploads `dist/` to S3
   and refreshes CloudFront. If any check fails, nothing is uploaded and the
   previous day's files stay live. If `data/` can't be downloaded the
   build fails rather than start over. For the very first run, start the
   workflow by hand with **new_history** checked (locally: `pnpm build:data --new-history`).
4. The ranking instructions are in [`pipeline/prompts/rank-movies.md`](pipeline/prompts/rank-movies.md).

AWS setup is in [`infra/README.md`](infra/README.md).

## Develop

Requires Node.js 24 and pnpm (`corepack enable`).

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` and `pnpm build` need no keys. To build tonight's data, create a `.env` file:

```
TMDB_KEY=
MDBLIST_KEY=
ANTHROPIC_API_KEY=
```

```bash
pnpm build:data
```

Before committing:

```bash
pnpm check
```

It runs Prettier, ESLint, `astro check` and the tests (the TMDB/MDBList tests run only when their keys are set).

### Stack

This repo is the template for Mick Schroeder's other sites:

- [Astro](https://astro.build) static output, React islands only where something is interactive
- [shadcn/ui](https://ui.shadcn.com) Luma style on Base UI, black and white with emerald accents, Lucide icons, Helvetica (Inter Tight where it isn’t installed)
- TypeScript everywhere; Node runs `pipeline/` and `test/` directly (type stripping)
- Pieces meant to be shared across sites live in `src/components/site/`
- `.mcp.json` adds the Astro Docs and shadcn MCP servers for AI coding agents

Add shadcn components with `pnpm dlx shadcn@latest add <name>`.

### Settings

The date window, vote minimums, list size and model effort are constants in
`pipeline/config.ts`; edit them there. The model can be changed without a code change
by setting `ANTHROPIC_MODEL` in `.env` or as a GitHub Actions variable
(default `claude-haiku-5-5`).

Set `SITE_URL` to download history from somewhere else.

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

MIT
