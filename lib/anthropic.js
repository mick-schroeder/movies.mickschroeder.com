const fs = require('fs')
const path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const config = require('../config')

// The ranking instructions live in a Markdown file so they're easy to edit
const PROMPT_PATH = path.join(__dirname, '../prompts/rank-movies.md')

const SCORES_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, score: { type: 'integer' } },
        required: ['id', 'score'],
        additionalProperties: false
      }
    }
  },
  required: ['scores'],
  additionalProperties: false
}

// Asks the AI model to score every movie 0-100. Returns { [id]: score }.
// Ids that weren't in the input are dropped.
async function scoreMovies (movies) {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  const system = fs.readFileSync(PROMPT_PATH, 'utf8')

  const response = await client.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 16000,
    output_config: {
      effort: config.ANTHROPIC_EFFORT,
      format: { type: 'json_schema', schema: SCORES_SCHEMA }
    },
    system,
    messages: [{ role: 'user', content: JSON.stringify(movies) }]
  })

  console.log({
    model: response.model,
    stop_reason: response.stop_reason,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  })

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`The model stopped with "${response.stop_reason}" instead of returning scores`)
  }

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  const ids = new Set(movies.map(movie => movie.id))
  const scores = {}
  for (const { id, score } of JSON.parse(text).scores) {
    if (ids.has(id)) scores[id] = Math.min(100, Math.max(0, score))
  }
  return scores
}

module.exports = { scoreMovies }
