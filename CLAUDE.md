# Best Pictures

Astro + shadcn site with a nightly data pipeline. See README.md for layout and commands.

- pnpm only. Run `pnpm check` before calling work done.
- Check changes in the browser against `pnpm dev`, which picks up edits as you save. `pnpm preview` serves the last `pnpm build`; use it only to check the built site.
- Keep it simple: stock Astro and shadcn features over custom code; React islands only for interactivity.
- Use established UI patterns: shadcn components and blocks, lucide icons, the way they're typically used. If a common pattern already exists, use it as is; don't invent new controls, combine them in unusual ways, or draw custom icons. If no standard pattern fits, ask first. The big display typography (page headings, the movie page's prev/next ranks) is the site's look; keep it.
- Add shadcn components with `pnpm dlx shadcn@latest add`; don't edit `src/components/ui/` by hand.
- Use the `astro-docs` and `shadcn` MCP servers to check current APIs instead of guessing.
- `best-pictures.json`, `best-pictures-YYYYMMDD.json` and `best-pictures-YYYY.json` keep Steven Lu's popular-movies format, a public contract (`ListMovie` in `src/lib/types.ts`); don't change it. The home page lists `best-pictures.json` and each year page its `best-pictures-YYYY.json`, exactly. `data/*.json` is the site's own working data and can change.
- `pipeline/` and `test/` run under Node type stripping: erasable TypeScript only, imports end in `.ts`.
- `src/components/site/` holds pieces meant to be shared with other sites; keep them site-agnostic.
