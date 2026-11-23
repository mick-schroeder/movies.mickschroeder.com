## 2026-11-22

* Fork of sjlu/popular-movies, published at https://movies.mickschroeder.com. Same file names and JSON format.
* Ranking uses the Anthropic API directly (was OpenRouter). Prompt moved to `prompts/rank-movies.md`.
* Ratings come from MDBList in one batch request, replacing OMDb and the Metacritic scraper. IMDb ratings now cover new releases that OMDb was missing.
* `movies.json` is now ranked as recommendations to a friend instead of by popularity: audience ratings count for more than critics'.
* The AI now also sees Letterboxd ratings and vote counts and the Rotten Tomatoes audience score.
* New lists: `movies-rottentomatoes-audience-min50` to `min80` and `movies-mdblist-min50` to `min80`.
* Fixed movies with no IMDb rating being dropped from `all-movies.json` and the Metacritic and Rotten Tomatoes lists.
* `movies.json` and the dated file now come from a single ranking call, so they always match.
* "Recent" is now measured from when a movie is out at home (first US digital or disc release, matching Radarr's Released setting), not from its theatrical release: movies are listed from 14 days before that until 180 days after. Previously a movie slow to reach digital lost most of its time on the lists.
* Re-releases of old movies (anniversary screenings and the like) are left out, since their home release is years old.
* `movies.json` has 20 movies (was 15) and always exactly that many (a run with fewer fails and leaves yesterday's files live), and the AI only picks movies with 500 or more TMDB votes, so picks wait until ratings have settled.
* Every list now needs 250 or more TMDB votes (was 100), keeping the lists closer to their original size. The TMDB average minimum is now 3 (was 4).
* The window, vote minimums and list size are constants at the top of `config.js`. The model can be set with `ANTHROPIC_MODEL`.
* Ranking costs about $9 a year instead of $45: it uses Claude Sonnet 5.5 and sends only title, genres, revenue and the main ratings, with empty fields left out.
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
