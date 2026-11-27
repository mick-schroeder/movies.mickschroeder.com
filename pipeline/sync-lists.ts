// Publishes the live best-pictures.json and year files as lists on other sites,
// so people can follow them there. Runs nightly after the site is live, so it
// reads the same files as everyone else.
//
// pipeline/lists.json maps each file to its list on each site. A file that isn't
// live yet (next year's) is skipped, and so is a site whose key isn't set:
//   mdblist  a static list, as "{username}/{list-slug}" from its URL
//            (also how the site links to it). Uses MDBLIST_KEY.
//   tmdb     a list, the number in its URL. Uses TMDB_LIST_TOKEN, a v4 user access
//            token for the lists' owner (see README).
//
// Usage:
//   pnpm sync:lists
import config from "./config.ts"
import lists from "./lists.json" with { type: "json" }
import type { ListMovie } from "../src/lib/types.ts"

async function mdblist(path: string, body?: unknown) {
  const separator = path.includes("?") ? "&" : "?"
  const resp = await fetch(
    `https://api.mdblist.com${path}${separator}apikey=${config.MDBLIST_KEY}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
  )
  if (!resp.ok) {
    throw new Error(
      `MDBList ${path} responded with ${resp.status}: ${await resp.text()}`
    )
  }
  return resp.json()
}

// Removes the movies that left, adds the new ones, then sets the order.
async function syncMdblist(list: string | number, movies: ListMovie[]) {
  // Changes need the list's number, which its URL doesn't show
  const [{ id }]: [{ id: number }] = await mdblist(`/lists/${list}`)
  const items = `/lists/${id}/items`
  const current: { id: number }[] =
    (await mdblist(`${items}?limit=1000`)).movies ?? []

  const wanted = new Set(movies.map((m) => m.tmdb_id))
  const listed = new Set(current.map((m) => m.id))
  const remove = current.filter((m) => !wanted.has(m.id))
  const add = movies.filter((m) => !listed.has(m.tmdb_id))

  if (remove.length > 0) {
    await mdblist(`${items}/remove`, {
      movies: remove.map((m) => ({ tmdb: m.id })),
    })
  }
  if (add.length > 0) {
    const result = await mdblist(`${items}/add`, {
      movies: add.map((m) => ({ tmdb: m.tmdb_id, imdb: m.imdb_id })),
    })
    // Usually a new release MDBList hasn't picked up yet; it's added on a later night
    if (result.not_found?.movies > 0) {
      console.warn(
        `MDBList couldn't find ${result.not_found.movies} movies yet`
      )
    }
  }
  await mdblist(`${items}/reorder`, {
    items: movies.map((m) => ({
      mediatype: "movie",
      ids: { tmdb: m.tmdb_id },
    })),
  })

  return { removed: remove.length, added: add.length }
}

async function tmdb(method: string, path: string, body?: unknown) {
  const resp = await fetch(`https://api.themoviedb.org/4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.TMDB_LIST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? null : JSON.stringify(body),
  })
  if (!resp.ok) {
    throw new Error(
      `TMDB ${method} ${path} responded with ${resp.status}: ${await resp.text()}`
    )
  }
  return resp.json()
}

// If the list isn't already these movies in this order, empties it and adds
// them; the list shows them in the order added.
async function syncTmdb(listId: string | number, movies: ListMovie[]) {
  const list = `/list/${listId}`
  const listed: number[] = []
  let sortBy = ""
  for (let page = 1, pages = 1; page <= pages; page++) {
    const data = await tmdb("GET", `${list}?page=${page}`)
    sortBy = data.sort_by
    pages = data.total_pages
    listed.push(...data.results.map((r: { id: number }) => r.id))
  }
  const wanted = movies.map((m) => m.tmdb_id)
  if (sortBy === "original_order.asc" && listed.join() === wanted.join()) {
    return { unchanged: true }
  }

  await tmdb("PUT", list, { sort_by: "original_order.asc" })
  const add = () =>
    tmdb("POST", `${list}/items`, {
      items: wanted.map((id) => ({ media_type: "movie", media_id: id })),
    })
  await tmdb("GET", `${list}/clear`)
  // The list is empty now, so try once more before leaving it that way
  const { results }: { results: { success: boolean }[] } = await add().catch(
    () => add()
  )
  const failed = results.filter((r) => !r.success).length
  if (failed > 0) console.warn(`TMDB couldn't add ${failed} movies`)

  return { added: results.length - failed }
}

const sites = {
  mdblist: { key: config.MDBLIST_KEY, sync: syncMdblist },
  tmdb: { key: config.TMDB_LIST_TOKEN, sync: syncTmdb },
}

// Each list on its own: one failing still lets the others update.
for (const [file, ids] of Object.entries(lists)) {
  let movies: ListMovie[]
  try {
    const resp = await fetch(`${config.SITE_URL}/${file}`)
    if (resp.status === 404) {
      console.log(`${file}: skipped, not live yet`)
      continue
    }
    if (!resp.ok) throw new Error(`responded with ${resp.status}`)
    movies = await resp.json()
    // An empty or broken file would empty the lists people follow
    if (
      !Array.isArray(movies) ||
      movies.length === 0 ||
      !movies.every((m) => Number.isInteger(m?.tmdb_id))
    ) {
      throw new Error("isn't a list of movies")
    }
  } catch (error) {
    console.error(`${file}:`, error)
    process.exitCode = 1
    continue
  }

  for (const [name, listId] of Object.entries(ids)) {
    const site = sites[name as keyof typeof sites]
    if (!site.key) {
      console.log(`${file} → ${name}: skipped, no key`)
      continue
    }
    try {
      console.log(`${file} → ${name}:`, await site.sync(listId, movies))
    } catch (error) {
      console.error(`${file} → ${name}:`, error)
      process.exitCode = 1
    }
  }
}
