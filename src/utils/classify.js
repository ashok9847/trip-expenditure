// Expense title -> sticker, in three layers:
//   1. keyword map (instant, offline)            -> stickers.js
//   2. AI fallback via a server endpoint          -> classifyExpense()
//   3. default location pin                       -> DEFAULT_STICKER
// The app works fully offline with layers 1 and 3.

import { DEFAULT_STICKER, SCENES, STICKER_KINDS, keywordSticker } from './stickers.js';

const CACHE_KEY = 'tripsplit:classify:v1';

/**
 * Where classification requests go. In dev, vite.config.js serves /api/classify
 * and forwards to Anthropic using ANTHROPIC_API_KEY from the server environment.
 * In production point VITE_CLASSIFY_ENDPOINT at your own backend (or leave it
 * empty to stay offline). Never put an API key in client code.
 */
export const CLASSIFY_ENDPOINT =
  import.meta.env?.VITE_CLASSIFY_ENDPOINT ?? (import.meta.env?.DEV ? '/api/classify' : '');

/**
 * Parse the model's reply. Tolerates ```json fences and stray prose.
 * @returns {{ emoji: string|null, category: string, scene: string, caption: string|null } | null}
 */
export function parseClassifierJson(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return null;
    const emoji = typeof obj.emoji === 'string' && obj.emoji.trim() ? [...obj.emoji.trim()].slice(0, 4).join('') : null;
    const category = typeof obj.category === 'string' ? obj.category.trim().toLowerCase().slice(0, 30) : '';
    const scene = SCENES.includes(obj.scene) ? obj.scene : 'misc';
    const caption = typeof obj.caption === 'string' && obj.caption.trim() ? obj.caption.trim().slice(0, 70) : null;
    return { emoji, category, scene, caption };
  } catch {
    return null;
  }
}

/** Turn a parsed AI answer into a sticker, preferring our own SVG art. */
export function stickerFromAi(parsed, title) {
  const fromCategory = keywordSticker(parsed.category) ?? (STICKER_KINDS.has(parsed.category) ? { kind: parsed.category } : null);
  if (fromCategory) {
    return { kind: fromCategory.kind, scene: parsed.scene !== 'misc' ? parsed.scene : fromCategory.scene ?? 'misc', emoji: null, caption: parsed.caption, source: 'ai' };
  }
  if (parsed.emoji) return { kind: 'emoji', scene: parsed.scene, emoji: parsed.emoji, caption: parsed.caption, source: 'ai' };
  return { ...DEFAULT_STICKER, scene: parsed.scene, caption: parsed.caption, title };
}

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const browserStorage = () => {
  try {
    return globalThis.localStorage ?? memoryStorage();
  } catch {
    return memoryStorage();
  }
};

/**
 * Build a classifier. Separate factory so tests can inject fetch/storage.
 */
export function createClassifier({ endpoint = CLASSIFY_ENDPOINT, fetchImpl = (...a) => globalThis.fetch(...a), storage = browserStorage() } = {}) {
  let cache = {};
  try {
    cache = JSON.parse(storage.getItem(CACHE_KEY) || '{}') || {};
  } catch {
    cache = {};
  }
  const inflight = new Map();
  const failed = new Set(); // don't retry the same title within a session

  const persist = () => {
    try {
      storage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* storage full or unavailable: the in-memory cache still works */
    }
  };

  /** Synchronous: keyword hit or cached AI answer, else null. */
  function peek(title) {
    const kw = keywordSticker(title);
    if (kw) return { ...kw, emoji: null, caption: null, source: 'keyword' };
    return cache[String(title || '').trim().toLowerCase()] ?? null;
  }

  async function classify(title) {
    const known = peek(title);
    if (known) return known;
    const key = String(title || '').trim().toLowerCase();
    if (!key || !endpoint || failed.has(key)) return DEFAULT_STICKER;
    if (inflight.has(key)) return inflight.get(key);

    const job = (async () => {
      try {
        const res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: key }),
        });
        if (!res.ok) throw new Error(`classify ${res.status}`);
        const body = await res.json();
        const parsed = parseClassifierJson(body?.text);
        if (!parsed) throw new Error('unparseable');
        const sticker = stickerFromAi(parsed, key);
        cache[key] = sticker;
        persist();
        return sticker;
      } catch {
        failed.add(key);
        return DEFAULT_STICKER;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, job);
    return job;
  }

  return { classify, peek };
}

const shared = createClassifier();
/** The one function the UI calls. */
export const classifyExpense = shared.classify;
export const peekSticker = shared.peek;
