// Movies as a grid of posters, each with its title and genres
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface Poster {
  id: string
  title: string
  poster_url: string | null
  href: string
  /** In the corner: what it's sorted by, or nothing. */
  badge: string | null
  genres: string
}

export function Posters({
  movies,
  label,
  className,
}: {
  movies: Poster[]
  label: string
  /** The grid's columns and spacing. */
  className?: string
}) {
  return (
    <ol className={cn("grid gap-x-4 gap-y-10", className)} aria-label={label}>
      {movies.map((movie, i) => (
        <li key={movie.id}>
          <a
            href={movie.href}
            className="group flex flex-col gap-3 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="relative aspect-2/3 overflow-hidden rounded-sm bg-muted">
              {movie.badge && (
                <Badge className="absolute top-2 left-2 font-bold tabular-nums">
                  {movie.badge}
                </Badge>
              )}
              {movie.poster_url && (
                <img
                  src={movie.poster_url}
                  alt=""
                  width="500"
                  height="750"
                  loading={i < 6 ? "eager" : "lazy"}
                  decoding="async"
                  className="size-full object-cover"
                />
              )}
            </div>
            <div>
              <div className="leading-snug font-medium group-hover:text-primary">
                {movie.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {movie.genres}
              </div>
            </div>
          </a>
        </li>
      ))}
    </ol>
  )
}
