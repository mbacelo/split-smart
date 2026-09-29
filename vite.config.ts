import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Server-side env vars the API function needs. These must NOT be exposed to the
// client bundle — they live only in the Node dev process (and, in production, in
// the Vercel serverless function). The AI key never reaches the browser.
const SERVER_ENV_KEYS = [
  'AI_PROVIDER',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_REASONING_EFFORT',
  'GOOGLE_CLIENT_ID',
  'ALLOWED_EMAILS',
  'ADMIN_EMAILS',
  'DATABASE_URL',
] as const;

// The /api endpoints served locally by the dev plugin. Add new api/*.ts
// handlers here so `npm run dev` picks them up (production is untouched —
// Vercel discovers them by filename).
const API_ENDPOINTS = ['analyze-receipt', 'join-waitlist', 'access-requests'] as const;

// Methods the dev plugin forwards. The handlers do their own per-endpoint
// method check; this is just the outer gate (Vercel has no equivalent).
const API_METHODS = ['GET', 'POST'] as const;

/**
 * Dev-only plugin: serves /api/* locally by running the SAME handlers that
 * Vercel runs in production (api/<name>.ts), so `npm run dev` gives us UI +
 * API together without the Vercel CLI. Env comes from .env.local via loadEnv —
 * local dev is authoritative and never round-trips to a linked cloud project.
 */
function devApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve', // dev server only; production build is untouched
    configureServer(server) {
      // Make the server-side vars visible to the handlers via process.env.
      for (const key of SERVER_ENV_KEYS) {
        if (env[key] !== undefined) process.env[key] = env[key];
      }

      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse) => {
        // With a mounted middleware, req.url is the path *after* /api.
        const name = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '');
        if (!(API_ENDPOINTS as readonly string[]).includes(name)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not found.' }));
          return;
        }
        if (!(API_METHODS as readonly string[]).includes(req.method || '')) {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed.' }));
          return;
        }

        try {
          // Adapt the Node request to the Web Request the handler takes. A GET
          // has no body, so skip straight past buffering it.
          let body: string | undefined;
          if (req.method !== 'GET') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            body = Buffer.concat(chunks).toString('utf8');
          }
          const request = new Request(`http://${req.headers.host}/api${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body,
          });

          // Load the real handler on demand; Vite transpiles the TS + .js ESM
          // specifiers, and its lib/ import chain resolves as in production.
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const response: Response = await mod.default.fetch(request);

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error(`[dev-api] ${name} error:`, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Dev API error.' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Read .env / .env.local (no VITE_ filter) so the dev API plugin can see the
  // server-side keys. Only VITE_-prefixed vars are ever sent to the client.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    // `npm run dev` serves the frontend AND /api together (see devApiPlugin).
    // The AI key is NEVER injected into the client bundle — it lives only in
    // the serverless function (api/analyze-receipt.ts), run in-process here.
    plugins: [react(), tailwindcss(), devApiPlugin(env)],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
  };
});
