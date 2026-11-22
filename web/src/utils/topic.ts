// A course topic always gets the same color pair (1..6, see --ot-topic-N-* in main.css) and a fitting icon.

export const TOPIC_TONES = 6;

/** Stable 1..6 from the topic name. */
export function topicTone(name: string | null | undefined): number {
  const s = (name ?? '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % TOPIC_TONES) + 1;
}

const ICONS: [RegExp, string][] = [
  [/safety|safe|hazard|ppe|first aid/, 'mdi-hard-hat'],
  [/survey|map|travers|gis/, 'mdi-map-marker-path'],
  [/electr|power|psu|voltage|circuit/, 'mdi-lightning-bolt'],
  [/bitcoin|btc|crypto|hash|asic|miner/, 'mdi-bitcoin'],
  [/repair|fix|maint|tool|solder/, 'mdi-wrench'],
  [/cool|fan|thermal|heat/, 'mdi-fan'],
  [/network|firmware|software|config/, 'mdi-chip'],
  [/geolog|rock|ore|drill|blast|mine|mining|underground/, 'mdi-pickaxe'],
];

/** An mdi icon name for a topic or course title. */
export function topicIcon(text: string | null | undefined): string {
  const s = (text ?? '').toLowerCase();
  return ICONS.find(([re]) => re.test(s))?.[1] ?? 'mdi-school-outline';
}
