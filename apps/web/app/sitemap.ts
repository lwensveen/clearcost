import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ['', 'quote', 'about', 'careers', 'contact', 'privacy', 'terms', 'status', 'track'].map(
    (p) => ({
      url: `https://clearcost.example/${p}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: p === '' ? 1 : 0.7,
    })
  );
}
