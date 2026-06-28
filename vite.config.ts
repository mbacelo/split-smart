import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // The AI key is NEVER injected into the client bundle. It lives only in
      // the serverless function (api/analyze-receipt.ts). Run `vercel dev` to
      // serve the frontend + /api together during local development.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
