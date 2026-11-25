// Bunny Stream webhook (2026-11-25): Bunny calls it when a video changes state (encoded, failed...).
// Without it a lesson stays "processing" until an admin opens the lesson page again.
//   POST /bunny/webhook   { VideoLibraryId, VideoGuid, Status }
// The body is not trusted: it only says WHICH video to check; the status itself is read back from Bunny's API.
import { Router } from 'express';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { syncVideoStatus } from '../admin/lessons.routes.js';

export const bunnyWebhookRouter = Router();

bunnyWebhookRouter.post('/bunny/webhook', async (req, res) => {
  const b = (req.body ?? {}) as { VideoLibraryId?: unknown; VideoGuid?: unknown };
  if (!config.bunnyStreamEnabled || String(b.VideoLibraryId ?? '') !== config.BUNNY_STREAM_LIBRARY_ID || typeof b.VideoGuid !== 'string') {
    return res.status(200).json({ received: false });
  }
  try {
    const lessons = await prisma.lesson.findMany({ where: { bunnyVideoId: b.VideoGuid }, select: { id: true } });
    for (const l of lessons) await syncVideoStatus(l.id);
    res.json({ received: true, lessons: lessons.length });
  } catch (e) {
    console.error('Bunny webhook:', e instanceof Error ? e.message : e);
    res.status(500).json({ received: false }); // Bunny retries
  }
});
