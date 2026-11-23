import { readFileSync } from "node:fs"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import * as z from "zod"
import config from "../config.ts"
import type { Scores } from "./types.ts"

// The ranking instructions live in a Markdown file so they're easy to edit
const PROMPT_PATH = new URL("../prompts/rank-movies.md", import.meta.url)

// What the model must answer with
const Answer = z.strictObject({
  scores: z.array(z.strictObject({ id: z.int(), score: z.int() })),
})

// Asks the AI model to score every movie 0-100. Returns { [id]: score }.
// Ids that weren't in the input are dropped.
export async function scoreMovies(movies: { id: number }[]): Promise<Scores> {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  const system = readFileSync(PROMPT_PATH, "utf8")

  const response = await client.messages.parse({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 16000,
    output_config: {
      effort: config.ANTHROPIC_EFFORT,
      format: zodOutputFormat(Answer),
    },
    system,
    messages: [{ role: "user", content: JSON.stringify(movies) }],
  })

  console.log({
    model: response.model,
    stop_reason: response.stop_reason,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  })

  if (response.stop_reason !== "end_turn") {
    throw new Error(
      `The model stopped with "${response.stop_reason}" instead of returning scores`
    )
  }

  const answer = response.parsed_output
  if (!answer) throw new Error("The model's answer didn't match the schema")

  const ids = new Set(movies.map((movie) => movie.id))
  const scores: Scores = {}
  for (const { id, score } of answer.scores) {
    if (ids.has(id)) scores[id] = Math.min(100, Math.max(0, score))
  }
  return scores
}
