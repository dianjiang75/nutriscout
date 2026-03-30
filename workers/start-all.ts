import "dotenv/config";

// Start both workers in a single process for simple deployments
console.log("[workers] Starting all workers...");

import("./crawl-worker").then(() => {
  console.log("[workers] Menu crawl worker started");
});

import("./logistics-worker").then(() => {
  console.log("[workers] Logistics worker started");
});

// Keep process alive and handle shutdown
process.on("SIGTERM", () => {
  console.log("[workers] SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[workers] SIGINT received, shutting down...");
  process.exit(0);
});
