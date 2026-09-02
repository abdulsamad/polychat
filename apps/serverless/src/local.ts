import { serve } from '@hono/node-server';

import { app } from './index';

const port = Number(process.env.PORT || 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.info(`PolyChat local API is listening on http://localhost:${info.port}`);
});
