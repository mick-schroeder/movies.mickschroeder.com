// The v1 file format: a JSON array of these objects. Existing consumers read
// `title` and `imdb_id`, so the shape must not change (see ListMovie).
import * as z from "zod"

const listMovie = z.strictObject({
  title: z.string().min(1),
  tmdb_id: z.int(),
  imdb_id: z.string({ error: "bad imdb_id" }).regex(/^tt\d+$/, "bad imdb_id"),
  poster_url: z.string().nullish(),
  genres: z.array(z.string()),
})

// Throws if a list isn't safe to publish. Nothing is written or uploaded when this fails.
export default function validateList(
  filename: string,
  movies: unknown,
  { min = 0, max = Infinity } = {}
) {
  const result = z.array(listMovie).min(min).max(max).safeParse(movies)
  if (!result.success) {
    throw new Error(
      `${filename} failed validation:\n${z.prettifyError(result.error)}`
    )
  }
}
