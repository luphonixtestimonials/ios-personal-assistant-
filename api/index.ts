import { handle } from '@hono/node-server/vercel';
import app from '../backend/src/index.js';

const baseHandler = handle(app);

export default async function vercelHandler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (req.body !== undefined && req.body !== null && !req.rawBody) {
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
      } else if (typeof req.body === 'string') {
        req.rawBody = Buffer.from(req.body);
      } else {
        req.rawBody = Buffer.from(JSON.stringify(req.body));
      }
    } else if (!req.rawBody && !req.readableEnded && typeof req.on === 'function') {
      try {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 3000);
          req.on('data', (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          req.on('end', () => {
            clearTimeout(timeout);
            req.rawBody = Buffer.concat(chunks);
            resolve();
          });
          req.on('error', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch {}
    }
  }

  return baseHandler(req, res);
}
