import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { classifyExpense, peekSticker } from '../utils/classify.js';
import { DEFAULT_STICKER } from '../utils/stickers.js';

/**
 * Stickers for a list of expense titles. Keyword hits are instant; unmatched
 * titles are classified in the background (once each) and re-render on arrival.
 */
export function useStickers(titles) {
  const [version, bump] = useReducer((x) => x + 1, 0);
  const key = [...new Set(titles.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].join('\n');

  useEffect(() => {
    let alive = true;
    for (const t of key.split('\n')) {
      if (t && !peekSticker(t)) classifyExpense(t).then((r) => alive && r.source === 'ai' && bump());
    }
    return () => {
      alive = false;
    };
  }, [key]);

  // Stable identity until a new AI sticker arrives, so the map layout doesn't rebuild every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const get = useCallback((title) => peekSticker(title) ?? DEFAULT_STICKER, [version]);
  return useMemo(() => ({ get, version }), [get, version]);
}

/** Live sticker for a title being typed (AI lookup debounced). */
export function useSticker(title, delay = 700) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const [debounced, setDebounced] = useState(title);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(title), delay);
    return () => clearTimeout(t);
  }, [title, delay]);
  useEffect(() => {
    let alive = true;
    if (debounced.trim() && !peekSticker(debounced)) classifyExpense(debounced).then((r) => alive && r.source === 'ai' && bump());
    return () => {
      alive = false;
    };
  }, [debounced]);
  return peekSticker(title) ?? DEFAULT_STICKER;
}
