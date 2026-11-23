// The v1 file format: a JSON array of these objects. Existing consumers read
// `title` and `imdb_id`, so the shape must not change (see ListMovie).
import * as z from "zod"

interface Options {
  min?: number
  max?: number
  requireImdbId?: boolean
}

const imdbId = z
  .string({ error: "bad imdb_id" })
  .regex(/^tt\d+$/, "bad imdb_id")

const listMovie = (requireImdbId: boolean) =>
  z.strictObject({
    title: z.string().min(1),
    tmdb_id: z.int(),
    imdb_id: requireImdbId ? imdbId : imdbId.nullish(),
    poster_url: z.string().nullish(),
    genres: z.array(z.string()),
  })

// Throws if a list isn't safe to publish. Nothing is written or uploaded when this fails.
export default function validateList(
  filename: string,
  movies: unknown,
  { min = 0, max = Infinity, requireImdbId = false }: Options = {}
) {
  const result = z
    .array(listMovie(requireImdbId))
    .min(min)
    .max(max)
    .safeParse(movies)
  if (!result.success) {
    throw new Error(
      `${filename} failed validation:\n${z.prettifyError(result.error)}`
    )
  }
}
