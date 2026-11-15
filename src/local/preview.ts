import { resolve } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import type { Plugin } from 'vite';
import { createGameApi } from '../server/service.ts';
import { LocalScoreStore } from './store.ts';
import { MemoryAttemptStore } from '../server/attempts.ts';
import { MemoryGuideStore } from '../server/guides.ts';

export function localPreview(): Plugin {
  const app = createGameApi({
    source: 'local',
    community: () => 'Your local atelier',
    store: new LocalScoreStore(resolve(process.cwd(), '.local', 'scores.json')),
    attempts: new MemoryAttemptStore(),
    guides: new MemoryGuideStore(),
    player: async (request) => {
      const id = request.headers.get('x-detour-player');
      if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return null;
      return { id, name: 'You' };
    },
  });
  const listener = getRequestListener(app.fetch);
  return {
    name: 'detour-local-preview',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/api/')) return next();
        void listener(request, response);
      });
    },
  };
}
