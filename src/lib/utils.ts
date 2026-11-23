export { cn } from "cn"

/** The first `count` genres for display: "science_fiction" -> "Science Fiction". */
export const genreLabel = (genres: string[] | undefined, count: number) =>
  (genres ?? [])
    .slice(0, count)
    .map((genre) =>
      genre.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(", ")
