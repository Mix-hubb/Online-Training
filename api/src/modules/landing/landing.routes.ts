// Public landing content.
//   GET /landing -> visible banners (ordered), sections by key, partner logos (showLogo = true, by logoOrder)
import { Router } from 'express';
import { h } from '../../lib/async.js';
import { loadLanding } from './landing.service.js';

export const landingRouter = Router();

landingRouter.get('/landing', h(async (_req, res) => res.json(await loadLanding())));
