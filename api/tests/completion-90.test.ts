import { beforeEach, describe, expect, it } from 'vitest';
import { isComplete, recordProgress } from '../src/modules/learning/progress.service.js';
import { enroll, makeCourse, makeUser, resetDb } from './helpers.js';

describe('90% completion rule', () => {
  beforeEach(resetDb);

  it('pure rule', () => {
    expect(isComplete(89, 100)).toBe(false);
    expect(isComplete(90, 100)).toBe(true);
    expect(isComplete(0, 0)).toBe(false);
  });

  async function watch(seconds: number) {
    const u = await makeUser();
    const c = await makeCourse({ durationSec: 100 });
    const e = await enroll(u.id, c.id);
    let now = new Date();
    let row;
    for (let done = 0; done < seconds; ) {
      const step = Math.min(10, seconds - done);
      row = await recordProgress(e, c.lessons[0], { position: done + step, watchedDelta: step }, now);
      done += step;
      now = new Date(now.getTime() + 10_000);
    }
    return row!;
  }

  it('89% not complete', async () => {
    const row = await watch(89);
    expect(row.watchedSec).toBe(89);
    expect(row.completed).toBe(false);
  });

  it('90% complete', async () => {
    const row = await watch(90);
    expect(row.completed).toBe(true);
  });
});
