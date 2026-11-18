import { beforeEach, describe, expect, it } from 'vitest';
import { allowedRenditions } from '../src/providers/video/VideoProvider.js';
import { as, enroll, makeCourse, makeUser, resetDb } from './helpers.js';

describe('video renditions', () => {
  beforeEach(resetDb);

  it('no upscaling past source', () => {
    expect(allowedRenditions(1080, true)).toEqual([720, 1080]);
    expect(allowedRenditions(720, true)).toEqual([720]);
    expect(allowedRenditions(480, true)).toEqual([480]);
    expect(allowedRenditions(null, true)).toEqual([]);
  });

  it('4K only when course allows it', () => {
    expect(allowedRenditions(2160, false)).toEqual([720, 1080]);
    expect(allowedRenditions(2160, true)).toEqual([720, 1080, 2160]);
  });

  it('player gets only allowed qualities', async () => {
    const u = await makeUser();
    const c = await makeCourse({ sourceHeight: 2160, allow4k: false });
    await enroll(u.id, c.id);
    const r = await as(u.id).get(`/lessons/${c.lessons[0].id}/play`);
    expect(r.body.qualities).toEqual([720, 1080]);
  });
});
