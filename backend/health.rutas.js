// backend/src/routes/health.rutas.js
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', app: 'VolunMatch API' });
});