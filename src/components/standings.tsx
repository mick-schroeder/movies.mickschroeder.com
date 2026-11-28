// The year's standings, as a chart or as posters, under one set of filters.
// The chart is a ridgeline, one ridge per movie (data/rankings.json), drawn
// edge to edge. A ridge's height each night is how high the movie ranked (#1
// tallest, off the list flat; squared so the top spots stand out), smoothed over
// two weeks so nightly wobbles don't show, easing flat after the last night.
// Later rows are drawn in front. The titles are an HTML list of links over the
// chart's left edge, one per row.
import * as d3 from "d3"
import { navigate } from "astro:transitions/client"
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChartArea,
  CheckIcon,
  ChevronDownIcon,
  LayoutGrid,
} from "lucide-react"
import {
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { type Poster, Posters } from "@/components/posters"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
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
  handInked,
  pastYear,
  type Ridge,
  ridgeArea,
  ridgeLine,
  ridges,
  RUNOUT_DAYS,
  utc,
  yearListOf,
  yearSpan,
} from "@/lib/ridgeline"
import { moviePath } from "@/lib/links"
import { cn, genreLabel } from "@/lib/utils"
import type { Catalog, RankDay } from "@/lib/types"

/**
 * Row spacing (at most, and at least when closing up to fit the screen), title
 * size, title column width and page gutter, at Tailwind's breakpoints (sm 640,
 * lg 1024). Phone rows stay 24px apart, so every title is an easy tap.
 */
function sizes(width: number) {
  if (width >= 1024)
    return { row: 26, minRow: 18, font: 16, column: 300, gutter: 24 }
  if (width >= 640)
    return { row: 24, minRow: 18, font: 15, column: 260, gutter: 24 }
  return { row: 24, minRow: 24, font: 14, column: 150, gutter: 16 }
}
// How many rows tall a #1 ridge stands
const PEAK = 5

// How the rows can be ordered, top to bottom
const ORDERS = {
  rank: {
    label: "Rank",
    compare: (a: Ridge, b: Ridge) => a.rank - b.rank,
  },
  joined: {
    label: "Date added",
    compare: (a: Ridge, b: Ridge) => b.row - a.row,
  },
  release: {
    label: "Release date",
    compare: (a: Ridge, b: Ridge) =>
      (a.release_date ?? "9").localeCompare(b.release_date ?? "9"),
  },
  best: {
    label: "Peak rank",
    compare: (a: Ridge, b: Ridge) => a.best - b.best || b.nights - a.nights,
  },
  title: {
    label: "Title",
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
    best: `Peak #${d.best}`,
    title: null,
  }[order]
}

// What the chart shows: one year's list, or the current movies over the last 365 days
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
  const movies = ridges(data, start, end, RUNOUT_DAYS)
    .filter((movie) => !current || movie.last !== null)
    // The current view ranks by the latest night's list; a year by its list
    .map((movie) => (current ? { ...movie, rank: movie.last! } : movie))
    .sort((a, b) => (reversed ? -1 : 1) * ORDERS[order].compare(a, b))
    .map((movie, row) => ({ ...movie, row }))
  return { start, end, movies }
}

// Where everything goes at this width, in this much height
type Layout = ReturnType<typeof layout>
function layout(
  view: View,
  order: Order,
  reversed: boolean,
  width: number,
  fit: number
) {
  const { start, end, movies } = rows(view, order, reversed)
  const { minRow, ...size } = sizes(width)
  // Rows close up so the whole chart fits the screen, down to the floor
  const fitted = Math.floor((fit - 40) / (movies.length - 1 + PEAK))
  const row = Math.max(minRow, Math.min(size.row, fitted))
  const font = Math.min(size.font, Math.round(row * 0.65))
  const top = row * PEAK
  const height = top + (movies.length - 1) * row + 40
  // The titles' column at the left; the ridges' days after it
  const x = d3.scaleUtc(
    [start, end + RUNOUT_DAYS * DAY],
    [size.gutter + size.column + 12, width - 12]
  )
  return { start, end, movies, ...size, row, font, top, height, width, x }
}

function draw(chart: HTMLElement, l: Layout) {
  const { start, end, movies, row, top, height, width, x } = l
  // Each ridge in pixels, running in flat from the left edge (behind its
  // title) and out to the right edge
  const shape = (d: Ridge) =>
    handInked(
      d.id,
      d.points.map(([t, h]) => [x(t), h * row * PEAK]),
      width
    )

  // Decoration for sighted mouse users; the list of titles is the content
  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("aria-hidden", "true")

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

  // The filled area hides the rows behind it; the stroke is the ridge line
  const ridge = svg
    .append("g")
    .selectAll("g")
    .data(movies)
    .join("g")
    .attr("class", "ridge")
    .attr("transform", (_, i) => `translate(0,${top + i * row})`)
  ridge
    .append("path")
    .attr("class", "fill")
    .attr("d", (d) => ridgeArea(shape(d)))
  ridge
    .append("path")
    .attr("class", "line")
    .attr("d", (d) => ridgeLine(shape(d)))
  ridge
    .filter((d) => {
      const released = d.release_date ? utc(d.release_date) : NaN
      return released >= start && released < end
    })
    .append("circle")
    .attr("class", "release")
    .attr("cx", (d) => x(utc(d.release_date!)))
    .attr("r", 2)
  // The highlighted ridge's line again, faint, over everything
  svg.append("path").attr("class", "ghost")

  chart.replaceChildren(svg.node()!)
}

// The highlighted ridge keeps its place, so the rows in front still cover it;
// its faint copy on top shows the parts they hide
function highlight(chart: HTMLElement, id: string | null) {
  const svg = d3.select(chart).select("svg")
  const on = svg
    .selectAll<SVGGElement, Ridge>(".ridge")
    .classed("on", (d) => d.id === id)
    .filter(".on")
  svg
    .select(".ghost")
    .attr("d", on.empty() ? null : on.select(".line").attr("d"))
    .attr("transform", on.empty() ? null : on.attr("transform"))
}

// The ridge seen at a point: the front-most row whose shape covers it. Each
// row also reaches half a row either side of its line, so flat ones are easy
// to hit and every point has one.
function pick(l: Layout, px: number, py: number): Ridge | null {
  const { start, movies, row, top, x } = l
  const day = Math.round((+x.invert(px) - start) / DAY)
  for (let i = movies.length - 1; i >= 0; i--) {
    const { points } = movies[i]!
    const at = points[Math.max(0, Math.min(points.length - 1, day))]
    const h = (at?.[1] ?? 0) * row * PEAK
    const base = top + i * row
    if (py >= base - h - row / 2 && py <= base + row / 2) return movies[i]!
  }
  return null
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
/** What a page shows: the current standings or one year's list. */
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

// Two ways to see the same list, on the same page; the visitor's pick is remembered
const VIEWS = [
  { value: "chart", label: "Plot", Icon: ChartArea },
  { value: "posters", label: "Posters", Icon: LayoutGrid },
] as const
type ViewName = (typeof VIEWS)[number]["value"]
const VIEW_KEY = "standings-view"
const noSubscribe = () => () => {}
function storedView(): ViewName {
  try {
    const stored = localStorage.getItem(VIEW_KEY)
    return VIEWS.find((v) => v.value === stored)?.value ?? "chart"
  } catch {
    return "chart" // Storage blocked
  }
}

export function Standings({
  years,
  choice,
  listed,
}: {
  years: number[]
  /** The page's list; picking another goes to its page. */
  choice: Choice
  listed: ListedMovie[]
}) {
  // The server renders the chart; the browser then shows the visitor's last pick
  const stored = useSyncExternalStore(noSubscribe, storedView, () => "chart")
  const [picked, setPicked] = useState<ViewName | null>(null)
  const view = picked ?? stored
  const [order, setOrder] = useState<Order>("rank")
  // Each order has a natural direction (best first, latest added first, A to Z); this flips it
  const [reversed, setReversed] = useState(false)
  // The chart's data once the history loads: none for this period yet, or it
  // couldn't be fetched (the posters still show the page's list)
  const [loaded, setLoaded] = useState<View | "empty" | "failed">()
  const data = typeof loaded === "object" ? loaded : null
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // The screen's height left below the chart's top
  const [fit, setFit] = useState(0)
  // The highlighted movie's id, from the pointer or keyboard focus
  const [hover, setHover] = useState<string | null>(null)

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
      if (!rankings || !movies) return setLoaded("failed")
      const shown = current
        ? pastYear(rankings, movies)
        : yearListOf(
            rankings,
            movies,
            listed.map((movie) => movie.id),
            Number(choice)
          )
      setLoaded(shown.days.length ? { data: shown, current } : "empty")
    })
    return () => {
      cancelled = true
    }
  }, [choice, listed])

  // The chart's width and the height it can fill, kept up to date
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      setWidth(wrap.clientWidth)
      setFit(innerHeight - wrap.getBoundingClientRect().top - scrollY)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      removeEventListener("resize", measure)
    }
  }, [view, data])

  const shown = useMemo(
    () => (data && width ? layout(data, order, reversed, width, fit) : null),
    [data, order, reversed, width, fit]
  )
  // Drawn again when coming back from posters, into a new, empty chart
  useEffect(() => {
    if (shown && chartRef.current) draw(chartRef.current, shown)
  }, [shown, view])
  useEffect(() => {
    if (chartRef.current) highlight(chartRef.current, hover)
  }, [hover, shown, view])

  // Only a mouse highlights by pointing; a tap goes straight to the movie
  const pointAt = (e: MouseEvent<HTMLElement>) => {
    if (!shown) return null
    const box = e.currentTarget.getBoundingClientRect()
    return pick(shown, e.clientX - box.left, e.clientY - box.top)
  }
  const ranked = order === "rank"
  // Behind the page: the highlighted movie, else the page's #1. Each one
  // seen stays mounted, so the browser keeps it and a swap can cross-fade,
  // once the new one has loaded.
  const behind = data?.data.movies[hover ?? String(listed[0]?.id)]
  const backdrop = behind?.backdrop_url ?? behind?.poster_url
  const [backdrops, setBackdrops] = useState<string[]>([])
  const [ready, setReady] = useState<string[]>([])
  const [onScreen, setOnScreen] = useState<string>()
  if (backdrop && !backdrops.includes(backdrop))
    setBackdrops([...backdrops, backdrop])
  if (backdrop && ready.includes(backdrop) && onScreen !== backdrop)
    setOnScreen(backdrop)

  // Before the history loads (and on the server), posters are the page's list.
  // Kept between highlights, which re-render this.
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

  const noRankings = (
    <Empty className="py-32">
      <EmptyDescription>
        No rankings for {choice === CURRENT ? "the past 12 months" : choice}{" "}
        yet.
      </EmptyDescription>
    </Empty>
  )

  return (
    <>
      {backdrops.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          className={cn("backdrop", url !== onScreen && "out")}
          decoding="async"
          onLoad={() => setReady((r) => [...r, url])}
        />
      ))}
      {/* How to see it, what to show, then how to order it, under the title */}
      <Tabs
        value={view}
        onValueChange={(next: ViewName) => chooseView(next)}
        className="gap-0"
      >
        <div className="relative z-10 mt-6 flex flex-wrap gap-2 px-4 sm:px-6">
          <TabsList>
            {VIEWS.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" aria-label="Time period" />}
            >
              {items.find((item) => item.value === choice)?.label}
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {items.map((item) => (
                <DropdownMenuItem
                  key={item.value}
                  render={
                    <a
                      href={choicePath(item.value)}
                      aria-current={item.value === choice ? "page" : undefined}
                    />
                  }
                >
                  {item.label}
                  {item.value === choice && (
                    <CheckIcon aria-hidden="true" className="ml-auto" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Toggle
            variant="outline"
            aria-label="Reverse order"
            pressed={reversed}
            onPressedChange={setReversed}
          >
            {reversed ? (
              <ArrowUpWideNarrow aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow aria-hidden="true" />
            )}
          </Toggle>
        </div>
        <TabsContent value="chart" className="text-base">
          {loaded === "empty" ? (
            noRankings
          ) : loaded === "failed" ? (
            <Empty className="py-32">
              <EmptyDescription>
                Couldn’t load the plot. Try Posters, or reload the page.
              </EmptyDescription>
            </Empty>
          ) : (
            <div
              ref={wrapRef}
              className="relative"
              onPointerLeave={() => setHover(null)}
            >
              <div
                ref={chartRef}
                className={cn(
                  "standings-chart",
                  !shown && "min-h-[60svh]",
                  hover && "cursor-pointer"
                )}
                onPointerMove={(e) => {
                  if (e.pointerType === "mouse")
                    setHover(pointAt(e)?.id ?? null)
                }}
                onClick={(e) => {
                  const movie = pointAt(e)
                  if (movie) navigate(moviePath(movie))
                }}
              />
              {shown && (
                <ol
                  aria-label={
                    data?.current
                      ? "The best movies of the past 12 months"
                      : `The best movies of ${data?.data.year}`
                  }
                  className="absolute"
                  style={{
                    top: shown.top - shown.row / 2,
                    left: shown.gutter,
                    width: shown.column,
                    fontSize: shown.font,
                  }}
                >
                  {shown.movies.map((movie) => (
                    <li key={movie.id} style={{ height: shown.row }}>
                      <a
                        href={moviePath(movie)}
                        className={cn(
                          "standings-title",
                          hover === movie.id && "on"
                        )}
                        onPointerMove={(e) => {
                          if (e.pointerType === "mouse") setHover(movie.id)
                        }}
                        onFocus={() => setHover(movie.id)}
                        onBlur={() => setHover(null)}
                      >
                        {ranked && <span className="rank">{movie.rank}</span>}
                        <span className="title">{movie.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </TabsContent>
        <TabsContent value="posters" className="text-base">
          {loaded === "empty" ? (
            noRankings
          ) : (
            <Posters
              movies={posters}
              label="Movies, in the chosen order"
              className="grid-cols-2 px-4 pt-10 sm:grid-cols-3 sm:px-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
