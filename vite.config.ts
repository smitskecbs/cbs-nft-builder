/// <reference types="vitest/config" />

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (env.PINATA_JWT) {
    process.env.PINATA_JWT = env.PINATA_JWT;
  }

  if (env.HELIUS_MAINNET_RPC) {
    process.env.HELIUS_MAINNET_RPC = env.HELIUS_MAINNET_RPC;
  }

  return {
    base: '/',
    server: {
      port: 5173,
      strictPort: true,
    },
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

            try {
              const { default: handler } = await import(
                './api/upload-to-pinata.js'
              );

              await handler(req, res);
            } catch {
              if (res.writableEnded) {
                return;
              }

              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Pinata upload failed.' }));
            }
          });
        },
      },
      {
        name: 'cbs-mainnet-rpc-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url?.split('?')[0];

            if (url !== '/api/rpc') {
              next();
              return;
            }

            try {
              const { default: handler } = await import('./api/rpc.js');

              await handler(req, res);
            } catch {
              if (res.writableEnded) {
                return;
              }

              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'RPC upstream unavailable' }));
            }
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
