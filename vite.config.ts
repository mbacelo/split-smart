import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Server-side env vars the API function needs. These must NOT be exposed to the
// client bundle — they live only in the Node dev process (and, in production, in
// the Vercel serverless function). The AI key never reaches the browser.
const SERVER_ENV_KEYS = [
  'AI_PROVIDER',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GOOGLE_CLIENT_ID',
  'ALLOWED_EMAILS',
] as const;

/**
 * Dev-only plugin: serves /api/analyze-receipt locally by running the SAME
 * handler that Vercel runs in production (api/analyze-receipt.ts), so `npm run
 * dev` gives us UI + API together without the Vercel CLI. Env comes from
 * .env.local via loadEnv — local dev is authoritative and never round-trips to
 * a linked cloud project.
 */
function devApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api-analyze-receipt',
    apply: 'serve', // dev server only; production build is untouched
    configureServer(server) {
      // Make the server-side vars visible to the handler via process.env.
      for (const key of SERVER_ENV_KEYS) {
        if (env[key] !== undefined) process.env[key] = env[key];
      }

      server.middlewares.use('/api/analyze-receipt', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed.' }));
          return;
        }

        try {
          // Buffer + parse the JSON body (the handler expects req.body).
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const body = rawBody ? JSON.parse(rawBody) : {};

          // Adapt Node req/res to the minimal VercelRequest/VercelResponse shape
          // the handler uses (method, headers, body / status().json()).
          const vReq = { method: req.method, headers: req.headers, body } as any;
          const vRes = {
            status(code: number) {
              res.statusCode = code;
              return this;
            },
            json(obj: unknown) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(obj));
              return this;
            },
          } as any;

          // Load the real handler on demand; Vite transpiles the TS + .js ESM
          // specifiers, and its lib/ai import chain resolves as in production.
          const mod = await server.ssrLoadModule('/api/analyze-receipt.ts');
          await mod.default(vReq, vRes);
        } catch (err) {
          console.error('[dev-api] analyze-receipt error:', err);
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
    plugins: [react(), devApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
