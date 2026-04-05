import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  // PrismaPg accepts pg.PoolConfig — pool settings at top level
  const adapter = new PrismaPg({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
    min: 2, // Keep warm connections for consistent latency
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Surface connection issues faster (was 10s)
  });
  return new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }, "warn", "error"],
  });
}

function withSlowQueryLogging(client: PrismaClient): PrismaClient {
  // Enable slow query logging in all environments — missing slow queries in prod
  // is worse than slightly noisier dev logs
  const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_MS || "500", 10);

  client.$on("query" as never, (e: unknown) => {
    const event = e as {
      query: string;
      params: string;
      duration: number;
      target: string;
    };
    if (event.duration >= SLOW_QUERY_THRESHOLD_MS) {
      console.warn(
        `[Prisma Slow Query] ${event.duration}ms | ${event.query} | params: ${event.params}`
      );
    }
  });

  return client;
}

function withSoftDeleteProtection(client: PrismaClient) {
  return client.$extends({
    query: {
      menuItem: {
        async delete({ args }) {
          console.warn(
            `[Prisma SoftDelete] menuItem.delete intercepted — converting to soft-delete`,
            { where: args.where }
          );
          return client.menuItem.update({
            where: args.where,
            data: { archivedAt: new Date(), archivedReason: "manual" },
          });
        },
        async deleteMany({ args }) {
          console.warn(
            `[Prisma SoftDelete] menuItem.deleteMany intercepted — converting to soft-delete`,
            { where: args.where }
          );
          return client.menuItem.updateMany({
            where: args.where,
            data: { archivedAt: new Date(), archivedReason: "manual" },
          });
        },
      },
    },
  });
}

const baseClient = withSlowQueryLogging(
  globalForPrisma.prisma ?? createPrismaClient()
);

export const prisma = withSoftDeleteProtection(baseClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = baseClient;
}
