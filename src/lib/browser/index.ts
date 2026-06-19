import puppeteer, { Browser, Page } from "puppeteer";
import { attachFingerprintToPage, fingerprints } from "./lib/fingerprints.ts";
import { createLocalProxy, closeAllLocalProxies } from "./lib/proxy.ts";
import { existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────
// One isolated browser per slot — each handles exactly 1 request at a time.
// 40 browsers = 40 concurrent solves = ~800 CPM at ~3s/solve.
const BROWSER_COUNT = Number(process.env.BROWSER_COUNT) || 20;
let headless = process.env.HEADLESS !== "false";
// ──────────────────────────────────────────────────────────────────────────────

export interface ProxyOptions {
  protocol: string;
  host: string;
  port: number | string;
  username?: string;
  password?: string;
}

export interface PageWithCursor extends Page {
  __dedicatedBrowser?: Browser; // proxy/iuam path only
}

// ─── Browser queue ────────────────────────────────────────────────────────────
// Each entry is one idle browser instance with its page pre-fingerprinted.
interface BrowserEntry {
  id: number;
  browser: Browser;
  page: PageWithCursor;
  busy: boolean;
}

const queue: BrowserEntry[] = [];
// Waiters: resolve functions for requests waiting for a free browser
const waiters: Array<(entry: BrowserEntry) => void> = [];
let isShuttingDown = false;
let initDone = false;
// ──────────────────────────────────────────────────────────────────────────────

function findChromeRecursive(dir: string, depth: number): string | null {
  if (depth > 10) return null;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name === "chrome" || entry.name === "chrome.exe"))
        return join(dir, entry.name);
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const found = findChromeRecursive(join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

function findBrowserExecutable(): string {
  const defaultPath = puppeteer.executablePath();
  if (defaultPath && existsSync(defaultPath)) return defaultPath;

  const homeDir = process.env.HOME || process.env.USERPROFILE || "/root";
  const searchDirs = [
    join(homeDir, ".cache", "puppeteer"),
    join(process.cwd(), "chromium"),
    join(process.cwd(), "chrome"),
  ];

  if (process.platform === "win32") {
    searchDirs.push(
      "C:\\Program Files\\Google\\Chrome\\Application",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application",
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application")
        : "",
    );
  }

  for (const baseDir of searchDirs) {
    if (!baseDir || !existsSync(baseDir)) continue;
    const found = findChromeRecursive(baseDir, 0);
    if (found) return found;
  }

  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN))
    return process.env.CHROME_BIN;

  throw new Error("No Chrome/Chromium binary found.");
}

function buildLaunchArgs(proxyServer?: string): string[] {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-site-isolation-trials",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certificate-errors",
    "--ignore-certificate-errors-spki-list",
    "--disable-accelerated-2d-canvas",
    "--hide-scrollbars",
    "--disable-notifications",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-ipc-flooding-protection",
    "--disable-renderer-backgrounding",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--mute-audio",
  ];
  if (proxyServer) args.push(`--proxy-server=${proxyServer}`);
  return args;
}

// ─── Launch one browser and get its single page ───────────────────────────────
async function launchOne(id: number, mode = "turnstile"): Promise<BrowserEntry> {
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: headless ? true : false,
    args: buildLaunchArgs(),
    defaultViewport: null,
    protocolTimeout: 0,
  });

  // Use the default blank page Chrome opens — no need to create a new one
  const pages = await browser.pages();
  const page = (pages[0] ?? await browser.newPage()) as PageWithCursor;

  const fp = fingerprints(mode);
  if (fp) await attachFingerprintToPage(page, fp);

  const entry: BrowserEntry = { id, browser, page, busy: false };

  browser.on("disconnected", () => {
    if (isShuttingDown) return;
    console.log(`[Browser ${id}] Crashed — respawning...`);
    const idx = queue.indexOf(entry);
    if (idx !== -1) queue.splice(idx, 1);
    // Respawn after short delay and put back in queue
    setTimeout(() => {
      launchOne(id).then((newEntry) => {
        queue.push(newEntry);
        console.log(`[Browser ${id}] Respawned, queue=${queue.length}`);
        drainWaiters();
      }).catch((e) => {
        console.error(`[Browser ${id}] Respawn failed:`, e);
      });
    }, 1500);
  });

  return entry;
}

// ─── Give a free browser to the next waiter in line ──────────────────────────
function drainWaiters() {
  while (waiters.length > 0) {
    const freeEntry = queue.find((e) => !e.busy);
    if (!freeEntry) break;
    freeEntry.busy = true;
    const resolve = waiters.shift()!;
    resolve(freeEntry);
  }
}

// ─── Acquire a browser from the queue (waits if all busy) ────────────────────
function acquireBrowser(): Promise<BrowserEntry> {
  const freeEntry = queue.find((e) => !e.busy);
  if (freeEntry) {
    freeEntry.busy = true;
    return Promise.resolve(freeEntry);
  }
  // All browsers busy — queue the waiter
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

// ─── Release browser back to the queue ───────────────────────────────────────
async function releaseBrowserEntry(entry: BrowserEntry) {
  try {
    if (!entry.page.isClosed()) {
      try { await entry.page.setRequestInterception(false); } catch {}
      await entry.page.goto("about:blank").catch(() => {});
      // Re-fingerprint so next solve gets a fresh identity
      const fp = fingerprints("turnstile");
      if (fp) await attachFingerprintToPage(entry.page, fp).catch(() => {});
    }
  } catch {}

  entry.busy = false;
  // Notify the next waiter immediately
  if (waiters.length > 0) {
    entry.busy = true;
    const resolve = waiters.shift()!;
    resolve(entry);
  }
}

// ─── Init: launch all BROWSER_COUNT instances in parallel ────────────────────
let initPromise: Promise<void> | null = null;

export async function initBrowser(options?: { headless?: boolean }): Promise<void> {
  if (options?.headless !== undefined) headless = options.headless;
  if (initDone) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log(`[Pool] Launching ${BROWSER_COUNT} isolated browsers...`);

    // Launch in parallel batches of 10 to avoid overwhelming the OS at once
    const BATCH = 10;
    for (let i = 0; i < BROWSER_COUNT; i += BATCH) {
      const batch = Array.from(
        { length: Math.min(BATCH, BROWSER_COUNT - i) },
        (_, j) => launchOne(i + j + 1),
      );
      const entries = await Promise.all(batch);
      for (const e of entries) queue.push(e);
      console.log(`[Pool] ${queue.length}/${BROWSER_COUNT} browsers ready`);
    }

    initDone = true;
    console.log(`[Pool] All ${BROWSER_COUNT} browsers ready`);
  })();

  return initPromise;
}

// ─── Public: get a page for a request ────────────────────────────────────────
export async function getPage(options?: {
  newPage?: boolean;
  proxy?: ProxyOptions;
  mode?: string;
}): Promise<PageWithCursor> {
  // Proxy requests always get a fresh dedicated browser (launched on demand)
  if (options?.proxy) {
    return createProxyPage(options.proxy, options.mode);
  }

  // iuam also gets a dedicated browser (needs full fresh session)
  if (options?.newPage) {
    return createDedicatedPage(options.mode);
  }

  // Turnstile — grab from the queue
  const entry = await acquireBrowser();
  console.log(`[Pool] Acquired browser ${entry.id}, waiters=${waiters.length}`);
  // Tag the page so releasePage knows which entry to return
  (entry.page as any).__queueEntry = entry;
  return entry.page;
}

// ─── Public: release page back ───────────────────────────────────────────────
export async function releasePage(page: PageWithCursor) {
  if (!page) return;

  // Dedicated browser (proxy / iuam) — close it entirely
  if (page.__dedicatedBrowser) {
    await page.__dedicatedBrowser.close().catch(() => {});
    return;
  }

  // Queue browser — recycle it
  const entry: BrowserEntry | undefined = (page as any).__queueEntry;
  if (entry) {
    console.log(`[Pool] Releasing browser ${entry.id}`);
    await releaseBrowserEntry(entry);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function cleanupAndExit() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("[Pool] Shutting down...");
  await closeAllLocalProxies().catch(() => {});
  await Promise.all(queue.map((e) => e.browser.close().catch(() => {})));
  process.exit(0);
}

process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);

// ─── Proxy / dedicated helpers ────────────────────────────────────────────────
async function createProxyPage(proxy: ProxyOptions, mode?: string): Promise<PageWithCursor> {
  const protocol = (proxy.protocol || "http").toLowerCase();
  const needsBridge = protocol.startsWith("socks") || protocol === "https";
  let proxyServer: string;

  if (needsBridge) {
    try { proxyServer = await createLocalProxy(proxy); }
    catch { proxyServer = `${protocol}://${proxy.host}:${proxy.port}`; }
  } else {
    proxyServer = `http://${proxy.host}:${proxy.port}`;
  }

  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: headless ? true : false,
    args: buildLaunchArgs(proxyServer),
    defaultViewport: null,
    protocolTimeout: 0,
  });

  const pages = await browser.pages();
  const page = (pages[0] ?? await browser.newPage()) as PageWithCursor;
  page.__dedicatedBrowser = browser;

  const fp = fingerprints(mode);
  if (fp) await attachFingerprintToPage(page, fp);

  if (!needsBridge && proxy.username && proxy.password) {
    await page.authenticate({ username: proxy.username, password: String(proxy.password) });
  }

  return page;
}

async function createDedicatedPage(mode?: string): Promise<PageWithCursor> {
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: headless ? true : false,
    args: buildLaunchArgs(),
    defaultViewport: null,
    protocolTimeout: 0,
  });

  const pages = await browser.pages();
  const page = (pages[0] ?? await browser.newPage()) as PageWithCursor;
  page.__dedicatedBrowser = browser;

  const fp = fingerprints(mode);
  if (fp) await attachFingerprintToPage(page, fp);

  return page;
}

// Legacy export kept for compatibility with iuam.ts
export { createDedicatedPage as connect };
