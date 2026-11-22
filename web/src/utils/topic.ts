// A course topic always gets the same color pair (1..6, see --ot-topic-N-* in main.css).

export const TOPIC_TONES = 6;

/** Stable 1..6 from the topic name. */
export function topicTone(name: string | null | undefined): number {
  const s = (name ?? '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % TOPIC_TONES) + 1;
}
