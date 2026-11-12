import type { MetadataRoute } from 'next';
import { guides, GUIDE_SITE_URL } from '@/lib/guides';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: GUIDE_SITE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${GUIDE_SITE_URL}/guides`, changeFrequency: 'weekly', priority: 0.8 },
    ...guides.map((guide) => ({ url: `${GUIDE_SITE_URL}/guides/${guide.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
  ];
}
