import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://foodclaw-production.up.railway.app";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/waitlist`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Dynamic dish pages
  let dishPages: MetadataRoute.Sitemap = [];
  try {
    const dishes = await prisma.dish.findMany({
      where: { isAvailable: true },
      select: { id: true, updatedAt: true },
      take: 5000,
    });
    dishPages = dishes.map((d) => ({
      url: `${baseUrl}/dish/${d.id}`,
      lastModified: d.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB not available during build
  }

  // Dynamic restaurant pages
  let restaurantPages: MetadataRoute.Sitemap = [];
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
      take: 5000,
    });
    restaurantPages = restaurants.map((r) => ({
      url: `${baseUrl}/restaurant/${r.id}`,
      lastModified: r.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB not available during build
  }

  return [...staticPages, ...dishPages, ...restaurantPages];
}
