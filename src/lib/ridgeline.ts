// The ridge math shared by the standings chart and the movie pages.
// A ridge's height each night is how high the movie ranked (#1 tallest, off the list
// flat; squared so the top spots stand out, with a floor so every ranked night
// shows), smoothed over about two weeks so nightly wobbles don't show.
import { bisector, randomLcg } from "d3"
import { LIST_SIZE as MAX_RANK } from "@/consts"
import type { Catalog, RankDay } from "@/lib/types"

const SMOOTH_DAYS = 15
// A missed night takes the night before; a longer gap shows as no data
const MAX_GAP_DAYS = 3
// The height of the lowest rank, as a share of #1's
const FLOOR = 0.08
export const DAY = 86400000

const height = (rank: number | undefined) =>
  rank ? FLOOR + (1 - FLOOR) * ((MAX_RANK + 1 - rank) / MAX_RANK) ** 2 : 0

// Each line wobbles a little, like it was inked by hand. The wobble is fixed per
// movie and baked into the shape, so it costs nothing to draw or animate.
const WOBBLE_PX = 0.9
export function wobble(id: string) {
  const rand = randomLcg(Number(id) || 1)
  const [a, b] = [rand() * 2 * Math.PI, rand() * 2 * Math.PI]
  return (px: number) =>
    WOBBLE_PX * (0.6 * Math.sin(px * 0.05 + a) + 0.4 * Math.sin(px * 0.13 + b))
}

/** What a chart draws: some nights' standings and the movies in them. */
export interface ChartData {
  /** The calendar year shown, or for the last 365 days the latest night's. */
  year: number
  days: RankDay[]
  movies: Catalog
}

export interface Ridge {
  id: string
  title: string
  release_date: string | null
  /** The first night it was ranked (YYYY-MM-DD). */
  joined: string
  row: number
  best: number
  nights: number
  /** Rank on the latest night, or null if it wasn't ranked then. */
  last: number | null
  /** Rank for the whole span: points every night it was ranked (#1 scores
   * MAX_RANK, the last spot 1), totalled. Roughly the area under its ridge. */
  rank: number
  points: [number, number][]
}

export const utc = (date: string) => Date.parse(date + "T00:00:00Z")
export const formatDate = (date: string) =>
  new Date(utc(date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })

const nightTime = bisector((night: RankDay) => utc(night.date))

/** The night whose standings cover time t (a missed night takes the night before), or null. */
function nightOn(nights: RankDay[], t: number): string | null {
  const night = nights[nightTime.right(nights, t) - 1]
  return night && t - utc(night.date) <= MAX_GAP_DAYS * DAY ? night.date : null
}

// One movie's ridge: [time, height 0-1] for every day of the year, smoothed.
// Days with no standings are flat.
export function ridgeline(
  byDate: Record<string, number>,
  nights: RankDay[],
  start: number,
  end: number
): [number, number][] {
  const heights: number[] = []
  for (let t = start; t < end; t += DAY) {
    const night = nightOn(nights, t)
    heights.push(night ? height(byDate[night]) : 0)
  }

  // A triangle-weighted average, so a jump rises with rounded shoulders. The
  // window narrows toward either end, so the latest night shows as it is.
  const half = Math.floor(SMOOTH_DAYS / 2)
  return heights.map((_, i) => {
    const h = Math.min(half, i, heights.length - 1 - i)
    let sum = 0
    for (let j = -h; j <= h; j++) sum += (h + 1 - Math.abs(j)) * heights[i + j]!
    return [start + i * DAY, sum / (h + 1) ** 2]
  })
}

// Rows in the order movies joined the standings
export function ridges(data: ChartData, start: number, end: number): Ridge[] {
  const latest = data.days.at(-1)?.ids ?? []
  const ranks: Record<string, Record<string, number>> = {}
  const order: string[] = []
  const joined: Record<string, string> = {}
  for (const night of data.days) {
    night.ids.forEach((id, i) => {
      if (!ranks[id]) {
        ranks[id] = {}
        joined[id] = night.date
        order.push(String(id))
      }
      ranks[id][night.date] = i + 1
    })
  }
  const points = (id: string) =>
    Object.values(ranks[id]!).reduce((sum, r) => sum + MAX_RANK + 1 - r, 0)
  const standing = order.toSorted((a, b) => points(b) - points(a))
  return order.map((id, row) => {
    const nightRanks = Object.values(ranks[id]!)
    const movie = data.movies[id]
    return {
      id,
      title: movie?.title ?? "Unknown",
      release_date: movie?.release_date ?? null,
      joined: joined[id]!,
      row,
      best: Math.min(...nightRanks),
      nights: nightRanks.length,
      last: latest.includes(Number(id)) ? latest.indexOf(Number(id)) + 1 : null,
      rank: standing.indexOf(id) + 1,
      points: ridgeline(ranks[id]!, data.days, start, end),
    }
  })
}

/** One calendar year's nights. */
export const yearOf = (
  rankings: RankDay[],
  movies: Catalog,
  year: number
): ChartData => ({
  year,
  days: rankings.filter((day) => day.date.startsWith(`${year}-`)),
  movies,
})

/** The last 365 days of nights, up to the latest. */
export function pastYear(rankings: RankDay[], movies: Catalog): ChartData {
  const latest = rankings.at(-1)
  const from = latest
    ? new Date(utc(latest.date) - 364 * DAY).toISOString().slice(0, 10)
    : ""
  return {
    year: Number(latest?.date.slice(0, 4)) || new Date().getUTCFullYear(),
    days: rankings.filter((day) => day.date >= from),
    movies,
  }
}

/** First and last day the chart shows: the whole year, or up to the latest night. */
export function yearSpan(data: { year: number; days: RankDay[] }) {
  const start = Date.UTC(data.year, 0, 1)
  const latest = data.days[data.days.length - 1]
  const end = Math.min(
    Date.UTC(data.year + 1, 0, 1),
    latest ? utc(latest.date) + DAY : start + DAY
  )
  return { start, end }
}
