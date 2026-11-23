// The year's standings, as a chart or as posters, under one set of filters.
// The chart is a ridgeline, one ridge per movie (best-pictures-YYYY.json), drawn
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
  DAY,
  formatDate,
  pastYear,
  type Ridge,
  ridges,
  utc,
  wobble,
  yearSpan,
} from "@/lib/ridgeline"
import { CopyUrl } from "@/components/copy-url"
import { SITE } from "@/consts"
import { moviePath } from "@/lib/links"
import { genreLabel } from "@/lib/utils"
import type { RankHistory } from "@/lib/types"

/**
 * Row spacing, title size and title column width at Tailwind's breakpoints
 * (sm 640, lg 1024, xl 1280). Phones have no room for titles.
 */
function sizes(width: number) {
  if (width >= 1280) return { row: 14, font: 13, column: 220 }
  if (width >= 1024) return { row: 13, font: 12, column: 205 }
  if (width >= 640) return { row: 12, font: 11, column: 190 }
  return { row: 7, font: 0, column: 0 }
}
const PEAK = 9 // a #1 ridge is this many rows tall

// The highlighted ridge comes to the front so its whole shape shows
function highlight(chart: HTMLElement, id: string | null) {
  const root = d3.select(chart)
  root.selectAll<SVGGElement, Ridge>(".label").classed("on", (d) => d.id === id)
  const all = root
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
    label: "When they joined",
    compare: (a: Ridge, b: Ridge) => a.row - b.row,
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
  nights: {
    label: "Most nights ranked",
    compare: (a: Ridge, b: Ridge) => b.nights - a.nights || a.best - b.best,
  },
  title: {
    label: "Title A–Z",
    compare: (a: Ridge, b: Ridge) => a.title.localeCompare(b.title),
  },
}
type Order = keyof typeof ORDERS

// What's known about a movie, one line per sort order (Title A–Z needs none: the
// title is always shown). A poster shows the one it's sorted by.
function facts(d: Ridge, current: boolean): Record<Order, string | null> {
  return {
    rank: current ? `Rank ${d.rank} tonight` : `Rank ${d.rank} for the year`,
    joined: `Joined ${formatDate(d.joined)}`,
    release: d.release_date
      ? `Released ${formatDate(d.release_date)}`
      : "Release date unknown",
    best: `Best rank ${d.best}`,
    nights: `${d.nights} night${d.nights === 1 ? "" : "s"} ranked`,
    title: null,
  }
}

// What the chart shows: one calendar year, or tonight's movies over the last 365 days
interface View {
  data: RankHistory
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
    // The current view ranks by tonight's list; a year by its points
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
  const { row, font, column } = sizes(width)
  const labels = font > 0
  const peak = PEAK
  const top = row * peak
  const bottom = 40
  const height = top + (movies.length - 1) * row + bottom
  // Titles in a column at the left edge; the latest night just inside the right
  const labelX = 12
  // Sorted by rank, each title leads with it ("12. ")
  const ranked = order === "rank"
  const rankWidth = ranked ? font * 0.6 * (String(movies.length).length + 1) : 0
  const x = d3.scaleUtc(
    [start, end],
    [labels ? labelX + rankWidth + column : 0, width - 12]
  )
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
        ? "How high tonight’s movies ranked over the last year"
        : `How high each movie ranked across ${data.year}`
    )

  svg
    .append("g")
    .selectAll("text")
    .data(d3.utcMonths(new Date(start), new Date(end - 14 * DAY)))
    .join("text")
    .attr("class", "month")
    .attr("x", (d) => x(d) + 6)
    .attr("y", height - 14)
    .text((d) =>
      d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
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

  // Titles in their own column, each on its own line, with a black plate
  // so the line passes behind it
  const label = labels
    ? svg
        .append("g")
        .selectAll("g")
        .data(movies)
        .join("g")
        .attr("class", "label")
        .attr("transform", (_, i) => `translate(${labelX},${top + i * row})`)
    : null
  label?.append("rect")
  label
    ?.append("text")
    .attr("y", font * 0.35)
    .attr("font-size", font)
    .text((d) => {
      const title = d.title.length > 30 ? d.title.slice(0, 29) + "…" : d.title
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

const load = (year: number): Promise<RankHistory | null> =>
  fetch(`/best-pictures-${year}.json`)
    .then((resp) => (resp.ok ? resp.json() : null))
    .catch(() => null)

const CURRENT = "current"
type Choice = typeof CURRENT | `${number}`

/** One of tonight's movies, from best-pictures.json (rendered on the server, before the history loads). */
export interface TonightMovie {
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
  /** Tonight's rank, or the year's; shown large. */
  rank: number
  detail: string
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
    current && d.last !== null
      ? ["Tonight", `#${d.last}`]
      : ["Year", `#${d.rank}`],
    ["Best", `#${d.best}`],
    ["Nights ranked", d.nights],
    ["Joined", formatDate(d.joined)],
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
              <Badge className="absolute top-2 left-2 font-bold tabular-nums">
                {movie.rank}
              </Badge>
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
                {movie.detail}
              </div>
            </div>
          </a>
        </li>
      ))}
    </ol>
  )
}

// Chart and posters are two pages (/ and /tonight/) sharing this island, which
// Astro keeps across the navigation (transition:persist), so the filters stay put.
const VIEWS = [
  { value: "chart", label: "Chart", href: "/", Icon: ChartArea },
  { value: "posters", label: "Posters", href: "/tonight/", Icon: LayoutGrid },
] as const
export type ViewName = (typeof VIEWS)[number]["value"]

export function Standings({
  years,
  view,
  tonight,
  children,
}: {
  years: number[]
  view: ViewName
  tonight: TonightMovie[]
  /** Shown beside the JSON field (the hero's links). */
  children?: ReactNode
}) {
  const [choice, setChoice] = useState<Choice>(CURRENT)
  const [order, setOrder] = useState<Order>("rank")
  // Each order has a natural direction (best first, newest last, A to Z); this flips it
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

  useEffect(() => {
    let cancelled = false
    const current = choice === CURRENT
    const wanted = current ? years.slice(0, 2) : [Number(choice)]
    Promise.all(wanted.map(load)).then((found) => {
      if (cancelled) return
      const histories = found.filter((h): h is RankHistory => !!h)
      const history = current ? pastYear(histories) : histories[0]
      setData(history?.days.length ? { data: history, current } : null)
    })
    return () => {
      cancelled = true
    }
  }, [choice, years])

  const choose = (value: Choice) => {
    setChoice(value)
    setOrder("rank")
    setReversed(false)
  }

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

  // Before the history loads (and on the server), posters are tonight's 25.
  // Kept between hovers, which re-render this.
  const posters = useMemo((): Poster[] => {
    const genres = new Map(tonight.map((m) => [String(m.id), m.genres]))
    return data
      ? rows(data, order, reversed).movies.map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster_url: data.data.movies[movie.id]?.poster_url ?? null,
          href: moviePath(movie),
          rank: movie.rank,
          // The value it's sorted by; for rank (on the badge) and title, its genres
          detail:
            order === "rank" || order === "title"
              ? genreLabel(genres.get(movie.id), 2) ||
                facts(movie, data.current).nights!
              : facts(movie, data.current)[order]!,
        }))
      : tonight.map((movie, i) => ({
          ...movie,
          id: String(movie.id),
          rank: i + 1,
          detail: genreLabel(movie.genres, 2),
        }))
  }, [data, order, reversed, tonight])

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
      {/* The file behind what's shown: tonight's list, or a year's */}
      <div className="mt-6 flex flex-wrap items-end gap-2 px-4 sm:px-6">
        <CopyUrl
          label="JSON"
          url={`${SITE.url}/best-pictures${choice === CURRENT ? "" : `-${choice}`}.json`}
        />
        {children}
      </div>
      {/* What to show, then how to order it, under the title */}
      <div className="relative z-10 mt-6 flex flex-wrap gap-2 px-4 sm:px-6">
        <Select
          items={items}
          value={choice}
          onValueChange={(value) => value && choose(value)}
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
            const item = VIEWS.find((v) => v.value === next)
            if (item && item.value !== view) navigate(item.href)
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
