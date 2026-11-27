export { cn } from "cn"

/** A genre for display: "science_fiction" -> "Science Fiction". */
export const genreName = (genre: string) =>
  genre.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())

/** The first `count` genres for display, comma-separated. */
export const genreLabel = (genres: string[] | undefined, count: number) =>
  (genres ?? []).slice(0, count).map(genreName).join(", ")
