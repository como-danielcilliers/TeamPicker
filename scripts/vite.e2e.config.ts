/**
 * Dev server for end-to-end testing the repo sync against a real GitHub repo
 * without putting a token in the browser. The page talks to /gh-api with a
 * dummy token; this server swaps in GH_TOKEN, and only for TEST_REPO.
 *
 *   $env:GH_TOKEN = gh auth token
 *   $env:TEST_REPO = "owner/repo"
 *   npx vite --config scripts/vite.e2e.config.ts --port 5199
 */
import { defineConfig, mergeConfig } from 'vite';
import type { Plugin } from 'vite';
import base from '../vite.config';

const token = process.env.GH_TOKEN ?? '';
const repo = (process.env.TEST_REPO ?? '').toLowerCase();
if (!token || !repo) throw new Error('Set GH_TOKEN and TEST_REPO.');

/** Lets the e2e run check the "repo not found" message without opening up other repos. */
const MISSING_REPO = `${repo.split('/')[0]}/teampicker-missing-repo-test`;

/** The page sends this to simulate a bad token; it is forwarded unchanged. */
const BAD_TOKEN = 'Bearer bad-token';

function guard(): Plugin {
  return {
    name: 'gh-api-guard',
    configureServer(server) {
      server.middlewares.use('/gh-api', (req, res, next) => {
        const path = (req.url ?? '').split('?')[0].toLowerCase();
        const allowed = [repo, MISSING_REPO].some(
          (r) => path === `/repos/${r}` || path.startsWith(`/repos/${r}/`),
        );
        if (!allowed) {
          res.statusCode = 403;
          res.end(JSON.stringify({ message: `e2e proxy only allows ${repo}` }));
          return;
        }
        next();
      });
    },
  };
}

export default mergeConfig(
  base,
  defineConfig({
    plugins: [guard()],
    define: { 'import.meta.env.VITE_GITHUB_API': JSON.stringify('/gh-api') },
    server: {
      proxy: {
        '/gh-api': {
          target: 'https://api.github.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/gh-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers.authorization !== BAD_TOKEN) {
                proxyReq.setHeader('Authorization', `Bearer ${token}`);
              }
            });
          },
        },
      },
    },
  }),
);
