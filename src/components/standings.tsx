// The year's standings, as a chart or as posters, under one set of filters.
// The chart is a ridgeline, one ridge per movie (data/rankings.json), drawn
// edge to edge like a hand-inked plot. A ridge's height each night is how high the movie
// ranked (#1 tallest, off the list flat; squared so the top spots stand out), smoothed
// over two weeks so nightly wobbles don't show. Later rows are drawn on top.
import * as d3 from "d3"
import { cn } from "cn"
import { navigate } from "astro:transitions/client"
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChartArea,
  LayoutGrid,
} from "lucide-react"
import {
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type ChartData,
  DAY,
  formatDate,
  pastYear,
  type Ridge,
  ridges,
  utc,
  wobble,
  yearOf,
  yearSpan,
} from "@/lib/ridgeline"
import { CopyUrl } from "@/components/copy-url"
import { SITE } from "@/consts"
import { moviePath } from "@/lib/links"
import { genreLabel } from "@/lib/utils"
import type { Catalog, RankDay } from "@/lib/types"

/**
 * Row spacing, title size, title column width, longest title (in characters) and
 * how many rows tall a #1 ridge stands, at Tailwind's breakpoints (sm 640, lg 1024,
 * xl 1280). Phones get a narrower column and shorter titles; wide screens taller
 * peaks, so the ridges don't look stretched.
 */
function sizes(width: number) {
  if (width >= 1280)
    return { row: 14, font: 13, column: 220, chars: 30, peak: 12 }
  if (width >= 1024)
    return { row: 13, font: 12, column: 205, chars: 30, peak: 10 }
  if (width >= 640)
    return { row: 12, font: 11, column: 190, chars: 30, peak: 9 }
  return { row: 10, font: 9, column: 105, chars: 22, peak: 9 }
}

// The highlighted ridge comes to the front so its whole shape shows
function highlight(chart: HTMLElement, id: string | null) {
  const all = d3
    .select(chart)
    .selectAll<SVGAElement, Ridge>(".ridge")
    .classed("on", (d) => d.id === id)
  if (id === null) all.sort((a, b) => a.row - b.row)
  else all.filter(".on").raise()
}

// How the rows can be ordered, top to bottom
const ORDERS = {
  rank: {
    label: "Rank",
    compare: (a: Ridge, b: Ridge) => a.rank - b.rank,
  },
  joined: {
    label: "Recently added",
    compare: (a: Ridge, b: Ridge) => b.row - a.row,
  },
  release: {
    label: "Release date",
    compare: (a: Ridge, b: Ridge) =>
      (a.release_date ?? "9").localeCompare(b.release_date ?? "9"),
  },
  best: {
    label: "Best rank",
    compare: (a: Ridge, b: Ridge) => a.best - b.best || b.nights - a.nights,
  },
  title: {
    label: "Title A–Z",
    compare: (a: Ridge, b: Ridge) => a.title.localeCompare(b.title),
  },
}
type Order = keyof typeof ORDERS

// What a poster's corner shows: the value it's sorted by, kept short. A title
// sort needs none (the title is always shown).
function badge(d: Ridge, order: Order): string | null {
  return {
    rank: String(d.rank),
    joined: formatDate(d.joined),
    release: d.release_date && formatDate(d.release_date),
    best: `Best #${d.best}`,
    title: null,
  }[order]
}

// What the chart shows: one calendar year, or the current movies over the last 365 days
interface View {
  data: ChartData
  current: boolean
}

// The movies to show, top to bottom, and the days they cover
function rows({ data, current }: View, order: Order, reversed = false) {
  const latest = data.days.at(-1)
  const { start, end } = current
    ? { start: utc(latest!.date) - 364 * DAY, end: utc(latest!.date) + DAY }
    : yearSpan(data)
  const movies = ridges(data, start, end)
    .filter((movie) => !current || movie.last !== null)
    // The current view ranks by the latest night's list; a year by its points
    .map((movie) => (current ? { ...movie, rank: movie.last! } : movie))
    .sort((a, b) => (reversed ? -1 : 1) * ORDERS[order].compare(a, b))
    .map((movie, row) => ({ ...movie, row }))
  return { start, end, movies }
}

function draw(
  view: View,
  order: Order,
  reversed: boolean,
  chart: HTMLElement,
  onHover: (ridge: Ridge | null) => void
) {
  const { data, current } = view
  const { start, end, movies } = rows(view, order, reversed)

  const width = chart.clientWidth
  const { row, font, column, chars, peak } = sizes(width)
  const top = row * peak
  const bottom = 40
  const height = top + (movies.length - 1) * row + bottom
  // Titles in a column at the left edge; the latest night just inside the right
  const labelX = 12
  // Sorted by rank, each title leads with it ("12. ")
  const ranked = order === "rank"
  const rankWidth = ranked ? font * 0.6 * (String(movies.length).length + 1) : 0
  const x = d3.scaleUtc([start, end], [labelX + rankWidth + column, width - 12])
  // Each ridge in pixels, wobble included: [x, y above its baseline]. Every line
  // runs in flat from the left edge (through its title) and carries on at its
  // latest height to the right edge.
  const step = (from: number, to: number) =>
    Array.from({ length: Math.max(0, Math.ceil((to - from) / 20)) }, (_, i) =>
      Math.min(from + i * 20, to)
    )
  const leadIn = step(0, x(start))
  const leadOut = step(x(end) + 20, width + 20)
  // [x, y, baseline y]: the baseline wobbles with the line, so a highlighted
  // fill has a hand-inked bottom edge too
  type Point = [number, number, number]
  const shape = (d: Ridge): Point[] => {
    const shake = wobble(d.id)
    const last = -d.points[d.points.length - 1]![1] * row * peak
    return [
      ...leadIn.map((px) => [px, 0]),
      ...d.points.map(([t, h]) => [x(t), -h * row * peak]),
      ...leadOut.map((px) => [px, last]),
    ].map(([px, py]) => [px!, py! + shake(px!), shake(px!)])
  }
  const area = d3
    .area<Point>()
    .y0((p) => p[2])
    .y1((p) => p[1])
    .curve(d3.curveBasis)
  const line = d3
    .line<Point>()
    .y((p) => p[1])
    .curve(d3.curveBasis)

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "group")
    .attr(
      "aria-label",
      current
        ? "The best movies of the past year, over time"
        : `The best movies of ${data.year}, over time`
    )

  const monthWidth =
    (x.range()[1]! - x.range()[0]!) / ((end - start) / (30 * DAY))
  svg
    .append("g")
    .selectAll("text")
    .data(d3.utcMonths(new Date(start), new Date(end - 14 * DAY)))
    .join("text")
    .attr("class", "month")
    .attr("x", (d) => x(d) + 6)
    .attr("y", height - 14)
    .text((d) =>
      d.toLocaleDateString("en-US", {
        // A letter a month when they're too close for "Jan"
        month: monthWidth < 32 ? "narrow" : "short",
        timeZone: "UTC",
      })
    )

  // Each ridge is a link to its movie's page, so it works from the keyboard and
  // Astro's router handles the navigation
  const ridge = svg
    .append("g")
    .attr("class", "ridges")
    .selectAll("a")
    .data(movies)
    .join("a")
    .attr("class", "ridge")
    .attr("href", (d) => moviePath(d))
    .attr("aria-label", (d) => d.title)
    .attr("transform", (_, i) => `translate(0,${top + i * row})`)

  // The filled area hides the rows behind it; the stroke is the ridge line
  ridge
    .append("path")
    .attr("class", "fill")
    .attr("d", (d) => area(shape(d)))
  ridge
    .append("path")
    .attr("d", (d) => line(shape(d)))
    .style("fill", "none")
  ridge
    .filter((d) => {
      const released = d.release_date ? utc(d.release_date) : NaN
      return released >= start && released < end
    })
    .append("circle")
    .attr("class", "release")
    .attr("cx", (d) => x(utc(d.release_date!)))
    .attr("r", 2)

  // Titles in their own column, each on its own line, with a black plate so the
  // line passes behind it. Part of the ridge's link, so a flat ridge can still be
  // hovered and tapped by its title.
  const label = ridge
    .append("g")
    .attr("class", "label")
    .attr("transform", `translate(${labelX},0)`)
  label.append("rect")
  label
    .append("text")
    .attr("y", font * 0.35)
    .attr("font-size", font)
    .text((d) => {
      const title =
        d.title.length > chars ? d.title.slice(0, chars - 1) + "…" : d.title
      return ranked ? `${d.rank}. ${title}` : title
    })

  ridge
    .on("focus", (_, d) => highlight(chart, d.id))
    .on("blur", () => highlight(chart, null))
    .on("pointerenter", (_, d) => {
      highlight(chart, d.id)
      onHover(d)
    })
    .on("pointerleave", () => {
      highlight(chart, null)
      onHover(null)
    })

  chart.replaceChildren(svg.node()!)

  // Size each plate to its rank and title, now that the text can be measured
  for (const group of chart.querySelectorAll<SVGGElement>(".label")) {
    const textWidth = group.getBBox().width
    d3.select(group)
      .select("rect")
      .attr("x", -4)
      .attr("y", -row / 2)
      .attr("width", textWidth + 8)
      .attr("height", row)
  }
}

const fetchJson = <T,>(path: string): Promise<T | null> =>
  fetch(path)
    .then((resp) => (resp.ok ? resp.json() : null))
    .catch(() => null)

// Every night's standings and the movies in them, fetched once for every view
let history: Promise<[RankDay[] | null, Catalog | null]> | undefined
const loadHistory = () =>
  (history ??= Promise.all([
    fetchJson<RankDay[]>("/data/rankings.json"),
    fetchJson<Catalog>("/data/movies.json"),
  ]))

const CURRENT = "current"
/** What a page shows: the current standings or one calendar year. */
export type Choice = typeof CURRENT | `${number}`
/** Each choice's page: / for the current standings, /year/2024/ for a year. */
export const choicePath = (choice: Choice) =>
  choice === CURRENT ? "/" : `/year/${choice}/`

/** One of the page's movies, best first (rendered on the server, before the history loads). */
export interface ListedMovie {
  id: number
  title: string
  poster_url: string | null
  genres: string[]
  href: string
}

interface Poster {
  id: string
  title: string
  poster_url: string | null
  href: string
  /** In the corner: what it's sorted by, or nothing. */
  badge: string | null
  genres: string
}

// The hovered movie's poster and what's known about it
function RidgeTip({
  ridge: d,
  current,
  poster,
}: {
  ridge: Ridge
  current: boolean
  poster: string | null | undefined
}) {
  const stats: [string, string | number][] = [
    current && d.last !== null ? ["Now", `#${d.last}`] : ["Year", `#${d.rank}`],
    ["Best", `#${d.best}`],
    ["Added", formatDate(d.joined)],
    ["Released", d.release_date ? formatDate(d.release_date) : "Unknown"],
  ]
  return (
    <div className="flex gap-3 py-0.5">
      {poster && (
        <img
          src={poster}
          alt=""
          width="185"
          height="278"
          className="w-24 self-start rounded-sm"
        />
      )}
      <div className="grid min-w-48 content-start gap-2">
        <div className="text-sm leading-snug font-semibold">{d.title}</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
          {stats.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="opacity-60">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </div>
  )
}

function Posters({ movies }: { movies: Poster[] }) {
  return (
    <ol
      className="grid grid-cols-2 gap-x-4 gap-y-10 px-4 pt-10 sm:grid-cols-3 sm:px-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      aria-label="Movies, in the chosen order"
    >
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

// Two ways to see the same list, on the same page; the visitor's pick is remembered
const VIEWS = [
  { value: "chart", label: "Chart", Icon: ChartArea },
  { value: "posters", label: "Posters", Icon: LayoutGrid },
] as const
type ViewName = (typeof VIEWS)[number]["value"]
const VIEW_KEY = "standings-view"
const noSubscribe = () => () => {}
function storedView(): ViewName {
  try {
    return localStorage.getItem(VIEW_KEY) === "posters" ? "posters" : "chart"
  } catch {
    return "chart" // Storage blocked
  }
}

export function Standings({
  years,
  choice,
  listed,
  children,
}: {
  years: number[]
  /** The page's list; picking another goes to its page. */
  choice: Choice
  listed: ListedMovie[]
  /** Shown beside the JSON field (the hero's links). */
  children?: ReactNode
}) {
  // The server renders the chart; the browser then shows the visitor's last pick
  const stored = useSyncExternalStore(noSubscribe, storedView, () => "chart")
  const [picked, setPicked] = useState<ViewName | null>(null)
  const view = picked ?? stored
  const [order, setOrder] = useState<Order>("rank")
  // Each order has a natural direction (best first, latest added first, A to Z); this flips it
  const [reversed, setReversed] = useState(false)
  const [data, setData] = useState<View | null | undefined>(undefined)
  const [swept, setSwept] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  // The tooltip keeps showing the last ridge while it fades out
  const [hover, setHover] = useState<Ridge | null>(null)
  const [hovering, setHovering] = useState(false)
  // TMDB's smaller size is plenty for the tooltip
  const poster =
    hover &&
    data?.data.movies[hover.id]?.poster_url?.replace("/w500/", "/w185/")

  const chooseView = (next: ViewName) => {
    setPicked(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage blocked: the pick lasts for this page only
    }
  }

  useEffect(() => {
    let cancelled = false
    const current = choice === CURRENT
    loadHistory().then(([rankings, movies]) => {
      if (cancelled) return
      if (!rankings || !movies) return setData(null)
      const shown = current
        ? pastYear(rankings, movies)
        : yearOf(rankings, movies, Number(choice))
      setData(shown.days.length ? { data: shown, current } : null)
    })
    return () => {
      cancelled = true
    }
  }, [choice])

  // Draw at the page's width, and redraw when that changes
  useEffect(() => {
    const chart = chartRef.current
    if (view !== "chart" || !data || !chart) return

    const onHover = (next: Ridge | null) => {
      if (next) setHover(next)
      setHovering(next !== null)
    }
    setHovering(false)
    draw(data, order, reversed, chart, onHover)

    let width = chart.clientWidth
    let timer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (chart.clientWidth === width) return
        width = chart.clientWidth
        draw(data, order, reversed, chart, onHover)
      }, 150)
    })
    observer.observe(chart)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [data, order, reversed, view])

  // Before the history loads (and on the server), posters are the page's list.
  // Kept between hovers, which re-render this.
  const posters = useMemo((): Poster[] => {
    return data
      ? rows(data, order, reversed).movies.map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster_url: data.data.movies[movie.id]?.poster_url ?? null,
          href: moviePath(movie),
          badge: badge(movie, order),
          genres: genreLabel(data.data.movies[movie.id]?.genres, 2),
        }))
      : listed.map((movie, i) => ({
          ...movie,
          id: String(movie.id),
          badge: String(i + 1),
          genres: genreLabel(movie.genres, 2),
        }))
  }, [data, order, reversed, listed])

  const items: { value: Choice; label: string }[] = [
    { value: CURRENT, label: "Current" },
    ...years.map((y) => ({ value: `${y}` as const, label: String(y) })),
  ]
  const orders = Object.entries(ORDERS).map(([value, { label }]) => ({
    value: value as Order,
    label,
  }))

  return (
    <>
      {/* The current list; each night's is also kept as best-pictures-YYYYMMDD.json */}
      <div className="mt-6 flex flex-wrap items-end gap-2 px-4 sm:px-6">
        <CopyUrl label="JSON" url={`${SITE.url}/best-pictures.json`} />
        {children}
      </div>
      {/* What to show, then how to order it, under the title */}
      <div className="relative z-10 mt-6 flex flex-wrap gap-2 px-4 sm:px-6">
        <Select
          items={items}
          value={choice}
          onValueChange={(value) =>
            value && value !== choice && navigate(choicePath(value))
          }
        >
          <SelectTrigger aria-label="Show">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={orders}
          value={order}
          onValueChange={(value) => value && setOrder(value)}
        >
          <SelectTrigger aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {orders.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label="Reverse order"
          aria-pressed={reversed}
          onClick={() => setReversed(!reversed)}
        >
          {reversed ? (
            <ArrowUpWideNarrow aria-hidden="true" />
          ) : (
            <ArrowDownWideNarrow aria-hidden="true" />
          )}
        </Button>
        <ToggleGroup
          aria-label="View"
          variant="outline"
          spacing={0}
          className="ml-auto"
          value={[view]}
          onValueChange={([next]) => {
            if (next) chooseView(next as ViewName)
          }}
        >
          {VIEWS.map(({ value, label, Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label}>
              <Icon aria-hidden="true" />
              <span className="max-sm:sr-only">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {data === null ? (
        <Empty className="py-32">
          <EmptyDescription>
            No standings for {choice === CURRENT ? "the last year" : choice}{" "}
            yet.
          </EmptyDescription>
        </Empty>
      ) : view === "posters" ? (
        <Posters movies={posters} />
      ) : (
        <div className="relative">
          <Tooltip open={hovering} trackCursorAxis="both">
            <TooltipTrigger
              render={
                <div
                  ref={chartRef}
                  className={cn("standings-chart", !data && "min-h-[60svh]")}
                />
              }
            />
            {hover && (
              <TooltipContent
                side="right"
                sideOffset={16}
                className="pointer-events-none block px-3 py-2"
              >
                <RidgeTip
                  ridge={hover}
                  current={data?.current ?? false}
                  poster={poster}
                />
              </TooltipContent>
            )}
          </Tooltip>
          {/* Slides off to the right once, so the chart comes in from the left */}
          {!swept && (
            <div
              aria-hidden="true"
              className="sweep"
              onAnimationEnd={() => setSwept(true)}
            />
          )}
        </div>
      )}
    </>
  )
}
