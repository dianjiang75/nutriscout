import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const menuCrawlQueue = new Queue("menu-crawl", { connection });
export const photoAnalysisQueue = new Queue("photo-analysis", { connection });
export const logisticsQueue = new Queue("logistics-update", { connection });

export { connection };
