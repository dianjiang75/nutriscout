/**
 * Singleton Playwright browser pool for delivery platform scraping.
 *
 * Manages a single Chromium instance with per-scrape BrowserContexts
 * for cookie/state isolation. Auto-restarts after N contexts to prevent
 * memory leaks from headless Chromium.
 */
import { chromium, type Browser, type BrowserContext } from "playwright-core";

const MAX_CONTEXTS_BEFORE_RESTART = 50;
const BROWSER_LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--no-sandbox",
];

/** Realistic Chrome user agents for rotation. */
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

/** Viewport sizes to randomize (common desktop resolutions). */
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
];

let browser: Browser | null = null;
let contextCount = 0;

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Launch or re-launch the browser. */
async function ensureBrowser(): Promise<Browser> {
  if (browser && browser.isConnected() && contextCount < MAX_CONTEXTS_BEFORE_RESTART) {
    return browser;
  }

  // Close old browser if exists
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Already closed
    }
  }

  browser = await chromium.launch({
    headless: true,
    args: BROWSER_LAUNCH_ARGS,
  });

  contextCount = 0;
  return browser;
}

/**
 * Create a new browser context with stealth settings.
 * Each scrape gets its own context for cookie/state isolation.
 *
 * IMPORTANT: Caller must call `context.close()` when done.
 */
export async function createScrapeContext(): Promise<BrowserContext> {
  const b = await ensureBrowser();

  const ua = randomChoice(USER_AGENTS);
  const viewport = randomChoice(VIEWPORTS);

  const context = await b.newContext({
    userAgent: ua,
    viewport,
    locale: "en-US",
    timezoneId: "America/New_York",
    // Block images/fonts/media to speed up scraping
    // (we extract photo URLs from the DOM, not the actual images)
  });

  // Remove webdriver flag that platforms check for bot detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
    // Override permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: "denied", onchange: null } as PermissionStatus)
        : originalQuery(parameters);
  });

  contextCount++;
  return context;
}

/** Human-like delay between 500ms and 2000ms. */
export function humanDelay(): Promise<void> {
  const ms = 500 + Math.random() * 1500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Short delay for rapid actions (200-500ms). */
export function quickDelay(): Promise<void> {
  const ms = 200 + Math.random() * 300;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Incrementally scroll the page to trigger lazy-loaded content.
 * Scrolls in human-like increments until no new content loads or max reached.
 */
export async function scrollToLoadAll(
  page: import("playwright-core").Page,
  maxScrolls: number = 20
): Promise<void> {
  let previousHeight = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;

    await page.evaluate(() =>
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" })
    );
    await humanDelay();
  }
  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0 }));
}

/**
 * Shutdown the browser pool. Call during graceful worker shutdown.
 */
export async function closeBrowserPool(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignore
    }
    browser = null;
    contextCount = 0;
  }
}
