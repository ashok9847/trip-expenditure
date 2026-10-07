import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buildAnthropicRequest } from './src/utils/classifyPrompt.js';

/**
 * POST /api/classify {title} -> {text}. Forwards to Anthropic with
 * ANTHROPIC_API_KEY read on the server (e.g. from .env.local). The key never
 * reaches the browser. Without a key it answers {text: null} and the app
 * falls back to its offline keyword stickers.
 */
function classifyProxy(env) {
  const handler = async (req, res, next) => {
    if (!req || req.url !== '/api/classify' || req.method !== 'POST') return next?.();
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };
    const key = env.ANTHROPIC_API_KEY;
    if (!key) return send(200, { text: null, disabled: true });
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 2000) return send(413, { error: 'too large' });
    }
    let title;
    try {
      title = JSON.parse(raw).title;
    } catch {
      return send(400, { error: 'bad json' });
    }
    if (typeof title !== 'string' || !title.trim() || title.length > 80) return send(400, { error: 'bad title' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(buildAnthropicRequest(title)),
      });
      const j = await r.json();
      if (!r.ok) return send(502, { error: 'upstream' });
      send(200, { text: (j.content ?? []).map((c) => c.text ?? '').join('') });
    } catch {
      send(502, { error: 'upstream' });
    }
  };
  return {
    name: 'classify-proxy',
    // Block bodies: a returned function would be run by Vite as a post-hook.
    configureServer: (server) => {
      server.middlewares.use(handler);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // includes non-VITE_ vars; server-side only
  return {
    // Relative asset paths so the build works from any sub-path and inside Android wrappers.
    base: './',
    plugins: [react(), tailwindcss(), ...(process.env.VITEST ? [] : [classifyProxy(env)])],
    // Listen on IPv4 + IPv6 (fixes "site can't be reached" on localhost) and the LAN.
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js'],
    },
  };
});
