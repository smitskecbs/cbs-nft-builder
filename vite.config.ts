/// <reference types="vitest/config" />

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (env.PINATA_JWT) {
    process.env.PINATA_JWT = env.PINATA_JWT;
  }

  return {
    base: '/',
    plugins: [
      {
        name: 'cbs-pinata-upload-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url?.split('?')[0];

            if (url !== '/api/upload-to-pinata') {
              next();
              return;
            }

            const { default: handler } = await import(
              './api/upload-to-pinata.js'
            );

            await handler(req, res);
          });
        },
      },
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
