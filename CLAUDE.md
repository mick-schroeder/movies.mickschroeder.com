# Best Pictures

Astro + shadcn site with a nightly data pipeline. See README.md for layout and commands.

- pnpm only. Run `pnpm check` before calling work done.
- Keep it simple: stock Astro and shadcn features over custom code; React islands only for interactivity.
- Add shadcn components with `pnpm dlx shadcn@latest add`; don't edit `src/components/ui/` by hand.
- Use the `astro-docs` and `shadcn` MCP servers to check current APIs instead of guessing.
- `best-pictures.json` and `best-pictures-YYYYMMDD.json` keep Steven Lu's popular-movies format, a public contract (`ListMovie` in `src/lib/types.ts`); don't change it. `data/*.json` is the site's own working data and can change.
- `pipeline/` and `test/` run under Node type stripping: erasable TypeScript only, imports end in `.ts`.
- `src/components/site/` holds pieces meant to be shared with other sites; keep them site-agnostic.
