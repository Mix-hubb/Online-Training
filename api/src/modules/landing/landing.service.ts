// Landing data loader: banners, sections (hero, home texts, footer, company), partner logos.
import { prisma } from '../../db.js';

export async function loadLanding() {
  const [banners, sections, partners] = await Promise.all([
    prisma.banner.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    // "bank" holds bank-transfer details and is served by /payments/bank-details instead.
    prisma.landingSection.findMany({ where: { key: { not: 'bank' } }, orderBy: { order: 'asc' } }),
    prisma.partner.findMany({
      where: { showLogo: true, logoUrl: { not: null } },
      orderBy: [{ logoOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, logoUrl: true, websiteUrl: true },
    }),
  ]);
  const byKey: Record<string, { content: unknown; isVisible: boolean; order: number }> = {};
  for (const s of sections) byKey[s.key] = { content: s.content, isVisible: s.isVisible, order: s.order };
  return {
    banners: banners.map((b) => ({ id: b.id, imageUrl: b.imageUrl, linkUrl: b.linkUrl, altText: b.altText })),
    sections: byKey,
    partners,
  };
}
