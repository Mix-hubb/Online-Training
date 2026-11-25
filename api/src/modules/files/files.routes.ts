// Serves stored files.
//   GET /files/public/<key>                 local disk (dev, or files uploaded before Bunny Storage was set up)
//   GET /files/private/<key>?exp=&sig=      HMAC-signed, short-lived. Read from Bunny's private zone when
//                                           Bunny Storage is set up, else (or if not found there) from local disk.
import express, { Router } from 'express';
import fs from 'node:fs';
import { config } from '../../config.js';
import { localPaths, verifyPrivate } from '../../providers/storage/LocalStorage.js';
import { readBunnyPrivate } from '../../providers/storage/BunnyStorage.js';

export const filesRouter = Router();

filesRouter.use('/files/public', express.static(localPaths.public, { fallthrough: false, maxAge: '1h' }));

/** Keys are made by the api (folder/uuid.ext); anything else is refused before it reaches a disk or Bunny. */
const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$/;

filesRouter.get(/^\/files\/private\/(.+)$/, async (req, res, next) => {
  try {
    const key = (req.params as Record<string, string>)[0];
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    if (!verifyPrivate(key, exp, sig)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Link expired' } });
    if (!SAFE_KEY.test(key)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, no-store');
    if (config.bunnyStorageEnabled) {
      const file = await readBunnyPrivate(key);
      if (file) return res.type(file.type).send(file.body);
    }
    let p: string;
    try {
      p = localPaths.resolvePrivate(key);
    } catch {
      return res.status(404).end();
    }
    if (!fs.existsSync(p)) return res.status(404).end();
    res.sendFile(p);
  } catch (e) {
    next(e);
  }
});
