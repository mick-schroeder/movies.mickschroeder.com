import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, fontProviders } from "astro/config"

const site = "https://movies.mickschroeder.com"

export default defineConfig({
  site,
  trailingSlash: "always",
  prefetch: true,
  // Helvetica's stand-in where it isn't installed; served from this site
  fonts: [
    {
      name: "Inter Tight",
      cssVariable: "--font-inter-tight",
      provider: fontProviders.fontsource(),
      weights: ["400 800"],
      styles: ["normal"],
      fallbacks: ["Arial", "sans-serif"],
    },
  ],
  vite: { plugins: [tailwindcss()] },
  integrations: [react(), sitemap({ customPages: [`${site}/llms.txt`] })],
})
