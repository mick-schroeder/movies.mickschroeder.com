# Best Pictures

Movies from the past year, recommended and ranked nightly by our AI editor.

This started as a fork of [sjlu/popular-movies](https://github.com/sjlu/popular-movies)
by Steven Lu. `best-pictures.json` keeps **the same JSON format**, so anything that read the
StevenLu lists can point at it.

## Usage

```
https://movies.mickschroeder.com/best-pictures.json
```

- Updated nightly. Poll at most once a day.

## Files

| File                                                                      | Contents                                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [best-pictures.json](https://movies.mickschroeder.com/best-pictures.json) | Tonight's standings: 25 movies, best first                                                                                              |
| `best-pictures-YYYY.json`                                                 | Every night's standings for one calendar year, e.g. [best-pictures-2026.json](https://movies.mickschroeder.com/best-pictures-2026.json) |

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

`best-pictures-YYYY.json` holds the TMDB ids for each night, best first, the details of every movie that has appeared, and each eligible movie's standing score after the latest night:

```json
{
  "year": 2026,
  "days": [{ "date": "2026-11-23", "ids": [3109, 550, ...] }],
  "movies": { "3109": { "title": "The Quiet Man", "imdb_id": "tt0045061", "poster_url": "...", "release_date": "1952-07-21", "links": { "letterboxd": "https://letterboxd.com/film/the-quiet-man/" } } },
  "scores": { "3109": 87.5 }
}
```

A movie's optional `links` holds the pages MDBList knows for it: `rottentomatoes`, `metacritic`, `letterboxd` and `trakt`, each a full URL.

Every night from Dec 2, 2019, until this site started ranking its own is backfilled from [Steven Lu's dated lists](https://github.com/sjlu/popular-movies#usage) (`movies-YYYYMMDD.json`: 15 recent movies, his order; lists before 2023 have only IMDb ids, so TMDB ids are looked up). Those days have `"source": "stevenlu"`; nights missing from his archive (for example Oct 25, 2025–Jan 21, 2026 and Mar 11–May 24, 2026) show as gaps. The backfill runs once, on the first run with `--new-history`, writing `best-pictures-2019.json` onward for every year the live site doesn't have yet.

Dates are UTC. The eligibility window is rolling (the last 365 days), so in January a year's file still includes movies from late the year before.

## How it works

The repo is one Astro + shadcn site with the data pipeline as a build step:

```
pipeline/   nightly data: TMDB + MDBList + AI scoring -> public/best-pictures.json, public/best-pictures-YYYY.json
src/        the site (Astro pages, React islands, shadcn components)
public/     static files copied as-is (llms.txt, robots.txt, and tonight's data once built)
infra/      AWS stack: S3 + CloudFront + GitHub OIDC role
```

1. `pnpm build:data` ([`pipeline/build.ts`](pipeline/build.ts)) does the work:
   - History - Downloads this year's and last year's `best-pictures-YYYY.json` from the live site.
   - Gather - Gets movies from TMDB first released in the last 365 days (re-releases of older movies are left out).
   - Enrich - Adds ratings from MDBList.
   - Score - The AI scores every movie with at least 500 TMDB votes from 0 to 100.
   - Rank - Each movie's standing score becomes 25% tonight's score and 75% last night's
     standing (`SMOOTHING` in `pipeline/config.ts`); a new movie starts at its first score. The top 25
     are tonight's standings.
   - Write - Checks `best-pictures.json` and the history, then writes them to `public/`.
2. `pnpm build` builds the site into `dist/`: the year's chart, tonight's 25, and a page for
   every movie that has been in the standings (`/title/{tmdb_id}-{title}/`) with its ridge, stats and
   links to TMDB, IMDb, Letterboxd, MDBList, Rotten Tomatoes, Metacritic and Trakt.
   Without `public/best-pictures.json` (local dev, CI) it uses the live file instead.
3. The `publish` GitHub Actions workflow runs both nightly, uploads `dist/` to S3
   and refreshes CloudFront. If any check fails, nothing is uploaded and the
   previous day's files stay live. If this year's history can't be downloaded the
   build fails rather than start over, except on Jan 1. For the very first run, start the
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
