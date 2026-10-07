// Shared by the browser (for tests/docs) and the dev-server proxy in vite.config.js.
// The API key only ever lives on the server side.

export const CLASSIFY_MODEL = 'claude-sonnet-4-6';
export const CLASSIFY_MAX_TOKENS = 1000;

export function buildClassifyPrompt(title) {
  return [
    'You label expenses from a group trip so an app can pick a sticker.',
    `Expense title: ${JSON.stringify(String(title).slice(0, 80))}`,
    'Reply with JSON ONLY (no prose, no code fences) in exactly this shape:',
    '{"emoji": "one emoji", "category": "one or two lowercase words", "scene": "beach|city|mountain|food|transport|stay|fun|misc", "caption": "short funny line, max 8 words, Hinglish welcome"}',
  ].join('\n');
}

/** Body for POST https://api.anthropic.com/v1/messages */
export function buildAnthropicRequest(title) {
  return {
    model: CLASSIFY_MODEL,
    max_tokens: CLASSIFY_MAX_TOKENS,
    messages: [{ role: 'user', content: buildClassifyPrompt(title) }],
  };
}
