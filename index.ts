import { Hono } from 'hono';
import backendApp from './backend/src/index.js';

const app = new Hono();
app.route('/', backendApp);

export default app;
