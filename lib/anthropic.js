const fs = require('fs')
const path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const config = require('../config')

// The ranking instructions live in a Markdown file so they're easy to edit
const PROMPT_PATH = path.join(__dirname, '../prompts/rank-movies.md')

const RANKING_SCHEMA = {
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'integer' }
    }
  },
  required: ['ids'],
  additionalProperties: false
}

// Asks the AI model to pick `count` movies. Returns an array of movie ids, best recommendation first.
async function rankMovies (movies, count) {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  // {{LIST_SIZE}} in the prompt becomes the number of movies to pick
  const system = fs.readFileSync(PROMPT_PATH, 'utf8').replaceAll('{{LIST_SIZE}}', String(count))

  const response = await client.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 16000,
    output_config: {
      effort: config.ANTHROPIC_EFFORT,
      format: { type: 'json_schema', schema: RANKING_SCHEMA }
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
    throw new Error(`The model stopped with "${response.stop_reason}" instead of returning a ranking`)
  }

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  return JSON.parse(text).ids
}

module.exports = { rankMovies }
