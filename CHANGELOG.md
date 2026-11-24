## 2026-11-24

* Each night's standings are also published as `best-pictures-YYYYMMDD.json`, in the same format as `best-pictures.json`, like Steven Lu's dated `movies-YYYYMMDD.json`. Files go back to Dec 2, 2019 (his lists before this site ranked its own).
* Removed `best-pictures-YYYY.json`. Its rankings, movie details and standing scores are now the site's own working data in `data/rankings.json`, `data/movies.json` and `data/scores.json`, which aren't a public contract.
* Every ranked movie's details now include its genres, runtime and YouTube trailer (from TMDB). Letterboxd and Trakt links are built from the TMDB id instead of stored.
* Movie pages are redesigned around a joyplot of the movie's year: the movies that joined the standings just before and after it stacked, this one in bold on top, with its release date, first ranked, best rank and tonight (or last ranked) pinned on its ridge. They also show the runtime, the links as a plain list with a Trailer link, and the movies ranked just above and below it tonight.

## 2026-11-23

* The site is now built with Astro and shadcn/ui (Luma style, black and white with small emerald accents). Tonight's standings are rendered into the page instead of loaded by script, and the standings chart and copy button are small React islands.
* One pnpm + TypeScript project: the nightly pipeline moved to `pipeline/` (`pnpm build:data`), lodash, moment and dotenv were replaced with built-ins, and tests run on `node:test`.
* The TMDB and MDBList credits use their logos from Simple Icons, drawn into the page; the old hotlinked TMDB logo had stopped working.
* File formats are unchanged. Tonight's list moved from `movies.json` to `best-pictures.json`.
* The home chart opens on Current recs (tonight's 25 over the last 365 days) and can show any year back to 2019. Earlier nights are backfilled from Steven Lu's lists. Every movie that has been ranked has its own page with links to TMDB, IMDb, Letterboxd, MDBList, Rotten Tomatoes, Metacritic and Trakt.
* Renamed to **Best Pictures**. Instead of the recent movies (which the StevenLu lists already cover), it now ranks the year's movies: everything released in the last 365 days, so a movie can stay in the standings all year.
* Each night's ranking is saved to `best-pictures-YYYY.json`, one file per calendar year, and the site charts every movie's rank across the year with its release date.
* The AI scores every movie 0-100 each night, and a movie's standing score is a running average of those scores (25% tonight, 75% last night's standing), so the standings move steadily instead of reshuffling. Standing scores are saved in `best-pictures-YYYY.json`.
* Ranking uses Claude Haiku 5.5 (was Sonnet 5.5) and costs about $1-2 a year (roughly 15k input and 4-5k output tokens a night).
* Movies count by their first release date, so re-releases of older movies (a late US release, an anniversary run) are left out.
* The list keeps the same format. Removed: `all-movies.json`, the `-minNN` filtered lists and new dated `movies-YYYYMMDD.json` files (existing dated files stay online).

## 2026-11-22

* Fork of sjlu/popular-movies, published at https://movies.mickschroeder.com. Same file names and JSON format.
* Ranking uses the Anthropic API directly (was OpenRouter). Prompt moved to `prompts/rank-movies.md`.
* Ratings come from MDBList in one batch request, replacing OMDb and the Metacritic scraper.
* `movies.json` is now ranked as recommendations to a friend instead of by popularity: audience ratings count for more than critics'.
* The AI now also sees Letterboxd ratings and vote counts and the Rotten Tomatoes audience score.
* New lists: `movies-rottentomatoes-audience-min50` to `min80` and `movies-mdblist-min50` to `min80`.
* Fixed movies with no IMDb rating being dropped from `all-movies.json` and the Metacritic and Rotten Tomatoes lists.
* `movies.json` and the dated file now come from a single ranking call, so they always match.
* "Recent" matches Radarr's Released setting. Previously a movie slow to reach digital lost most of its time on the lists.
* Re-releases of old movies (anniversary screenings and the like) are left out, since their home release is years old.
* `movies.json` has 20 movies (was 15).
* Every list now needs 250 or more TMDB votes (was 100).
* The TMDB average minimum is now 3 (was 4).
* The window, vote minimums and list size are constants at the top of `config.js`. The model can be set with `ANTHROPIC_MODEL`.
* Every list is checked before publishing; a failed check leaves the previous day's files live.
* Fixed empty `{}` entries when the AI returned an id that wasn't in the list it was given.
* TMDB and poster URLs use HTTPS.
* Hosting moved to S3 + CloudFront, published by GitHub Actions with OIDC (no stored AWS keys). Cloudflare R2 removed.
* Added `robots.txt`, `sitemap.xml` and `llms.txt`.
* Removed unused IMDb scraper, file cache, CSV dump, Redis and `DEBUG` settings, and the `exclude_genres` filter option.

## 2024-12-30

* MAJOR: Using Anthropic Claude 3.5 Sonnet for evaluation on main recommendation file. The original file is now `all-movies.json`.
* Swapped out Metacritic in favor of TMDB for the main source of movies.
* Fixed an issue where Metacritic ratings were not being pulled correctly from OMDB.

## 2023-09-11

* Moving to Cloudflare R2 for hosting.
* Changed hosted domain to popular-movies-data.stevenlu.com.

## 2022-12-23

* Beginning Dec. 12, 2023, generated JSON files on AWS now use gzip compression.
* Move generator from Heroku to GitHub Actions.
* Set minimum popularity to 30 (from 10).
* Get IMDB ratings directly from IMDB as a fallback.
* Adding additional tests for future proofing.
