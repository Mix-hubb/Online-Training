// Serves files from LocalStorage (dev/test). With Bunny Storage these routes are unused.
//   GET /files/public/<key>
//   GET /files/private/<key>?exp=&sig=   (HMAC-signed, short-lived)
import express, { Router } from 'express';
import fs from 'node:fs';
import { localPaths, verifyPrivate } from '../../providers/storage/LocalStorage.js';

export const filesRouter = Router();

filesRouter.use('/files/public', express.static(localPaths.public, { fallthrough: false, maxAge: '1h' }));

filesRouter.get(/^\/files\/private\/(.+)$/, (req, res) => {
  const key = (req.params as Record<string, string>)[0];
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig ?? '');
  if (!verifyPrivate(key, exp, sig)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Link expired' } });
  let p: string;
  try {
    p = localPaths.resolvePrivate(key);
  } catch {
    return res.status(404).end();
  }
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(p);
});
