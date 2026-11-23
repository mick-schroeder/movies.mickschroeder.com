import type { MovieSummary } from "@/lib/movies"

/** Where else to find a movie, best known first. */
export function movieLinks(movie: MovieSummary) {
  const { id, imdb_id, links = {} } = movie
  return [
    { name: "TMDB", url: `https://www.themoviedb.org/movie/${id}` },
    { name: "IMDb", url: `https://www.imdb.com/title/${imdb_id}/` },
    {
      name: "Letterboxd",
      url: links.letterboxd ?? `https://letterboxd.com/tmdb/${id}/`,
    },
    { name: "MDBList", url: `https://mdblist.com/movie/${imdb_id}` },
    links.rottentomatoes && {
      name: "Rotten Tomatoes",
      url: links.rottentomatoes,
    },
    links.metacritic && { name: "Metacritic", url: links.metacritic },
    links.trakt && { name: "Trakt", url: links.trakt },
  ].filter((link) => !!link)
}

/** A movie's page on this site: /title/tmdbid-title/. */
export function moviePath(movie: { id: number | string; title: string }) {
  const title = movie.title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `/title/${movie.id}-${title}/`
}
