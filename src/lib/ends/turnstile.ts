import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Page } from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache api.js in memory — avoids a disk read on every intercepted request
let cachedApiJs: Buffer | null = null;
function getApiJs(): Buffer {
  if (cachedApiJs) return cachedApiJs;
  const localPath = path.join(__dirname, "../browser/lib/js/api.txt");
  cachedApiJs = fs.readFileSync(localPath);
  return cachedApiJs;
}
// Invalidate whenever the updater rewrites the file
fs.watchFile(
  path.join(__dirname, "../browser/lib/js/api.txt"),
  { interval: 10_000 },
  () => { cachedApiJs = null; },
);

export interface TurnstileData {
  url: string;
  sitekey: string | string[];
  cdata?: string;
  action?: string;
  extractCdata?: boolean; // If true, intercept and return cdata from Cloudflare response
  proxy?: {
    protocol?: string;
    host: string;
    port: number | string;
    username?: string;
    password?: string;
  };
}

async function turnstile(data: TurnstileData, page: Page): Promise<string | string[] | { token: string | string[], cdata: string | null, user_agent: string }> {
  const { url, sitekey, cdata, action, extractCdata, proxy } = data;
  if (!url) throw new Error("Missing url parameter");
  if (!sitekey) throw new Error("Missing sitekey parameter");

  const siteKeys = Array.isArray(sitekey) ? sitekey : [sitekey];
  if (siteKeys.length === 0) throw new Error("Empty sitekey list");

  const timeout = (global as any).timeOut || 60000;
  let isResolved = false;

  // Variable to capture cdata from Cloudflare's response
  let capturedCdata: string | null = null;
  let userAgent: string = "";

  const cl = setTimeout(() => {
    if (!isResolved) {}
  }, timeout);

  let clickerActive = true;
  const clickerLoop = async () => {
    while (clickerActive) {
      if (page.isClosed()) break;
      try {
        const responseElements = await page.$$('[name="cf-turnstile-response"]');
        if (responseElements.length > 0) {
          for (const el of responseElements) {
            const parentBox = await page.evaluate((element: any) => {
              const parent = element.parentElement;
              if (!parent) return null;
              const rect = parent.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }, el).catch(() => null);

            if (parentBox && parentBox.width > 0 && parentBox.height > 0) {
              const clickX = parentBox.x + 30;
              const clickY = parentBox.y + parentBox.height / 2;
              await page.mouse.click(clickX, clickY).catch(() => {});
            }
          }
        } else {
          const iframes = await page.$$('iframe[src*="challenges.cloudflare.com"]');
          if (iframes.length > 0) {
            for (const iframe of iframes) {
              const box = await iframe.boundingBox().catch(() => null);
              if (box && box.width > 0 && box.height > 0) {
                const clickX = box.x + 30;
                const clickY = box.y + box.height / 2;
                await page.mouse.click(clickX, clickY).catch(() => {});
              }
            }
          }
        }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  clickerLoop();

  const requestHandler = async (req: any) => {
    if (req.isInterceptResolutionHandled()) return;

    try {
      const reqUrl = req.url();
      const resourceType = req.resourceType();

      if ([url, url + "/"].includes(reqUrl) && resourceType === "document") {
        const extraAttrs = [
          cdata ? ` data-cdata="${cdata}"` : "",
          action !== undefined && action !== null && action !== ""
            ? ` data-action="${action}"`
            : "",
        ].join("");

        const widgetDivs = siteKeys
          .map(
            (key, i) =>
              `<div class="cf-turnstile" data-sitekey="${key}" data-callback="cb_${i}"${extraAttrs}></div>`,
          )
          .join("\n");

        const callbacks = siteKeys
          .map(
            (_, i) => `function cb_${i}(token) {
                        var c = document.createElement('input');
                        c.type = 'hidden';
                        c.name = 'cf-response';
                        c.setAttribute('data-index', ${i});
                        c.value = token;
                        document.body.appendChild(c);
                    }`,
          )
          .join("\n");

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Challenge</title>
    <script>
        ${callbacks}
    </script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body>
    ${widgetDivs}
</body>
</html>`;

        await req.respond({
          status: 200,
          contentType: "text/html",
          body: htmlContent,
        });
      } else if (reqUrl.includes("challenges.cloudflare.com/reports/v0/post")) {
        await req.abort();
      } else if (extractCdata && reqUrl.includes("challenges.cloudflare.com") && reqUrl.includes("/turnstile/v0/")) {
        // Intercept Cloudflare's response to extract cdata
        // We'll capture it from the page after the widget loads
        await req.continue();
      } else if (
        reqUrl.includes("challenges.cloudflare.com/turnstile") &&
        reqUrl.includes("/api.js")
      ) {
        try {
          await req.respond({
            status: 200,
            contentType: "application/javascript",
            body: getApiJs(),
          });
        } catch (e) {
          console.error("Failed to serve local api.js:", e);
          await req.continue();
        }
      } else if (
        reqUrl.includes("challenges.cloudflare.com") ||
        reqUrl.includes("/cdn-cgi/challenge-platform/")
      ) {
        await req.continue();
      } else {
        await req.abort();
      }
    } catch (error) {
      if (!req.isInterceptResolutionHandled()) {
        try {
          await req.continue();
        } catch {}
      }
    }
  };

  try {
    // Apply proxy if provided
    if (proxy) {
      await page.authenticate({
        username: proxy.username || "",
        password: proxy.password || "",
      });
    }

    await page.setRequestInterception(true);
    page.on("request", requestHandler);

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Capture user agent
    userAgent = await page.evaluate(() => navigator.userAgent).catch(() => "");

    // If extractCdata is enabled, try to extract cdata from the widget after it loads
    if (extractCdata) {
      console.log("[Cdata Extraction] Waiting for widget to load...");
      await page.waitForSelector('.cf-turnstile', { timeout: 10000 }).catch(() => {});
      const extracted = await page.evaluate(() => {
        const widget = document.querySelector('.cf-turnstile') as HTMLElement;
        if (!widget) return { cdata: null };
        return { cdata: widget.getAttribute('data-cdata') };
      });
      if (extracted.cdata) {
        capturedCdata = extracted.cdata;
        console.log(`[Cdata Extraction] Captured cdata: ${capturedCdata}`);
      }
    }

    const tokens = await page
      .waitForFunction(
        (expectedCount) => {
          const inputs = document.querySelectorAll('input[name="cf-response"]');

          if (inputs.length >= expectedCount) {
            const results = new Array(expectedCount).fill(null);

            inputs.forEach((input) => {
              const idx = parseInt(input.getAttribute("data-index") || "0");
              if (!isNaN(idx) && idx < expectedCount) {
                results[idx] = (input as HTMLInputElement).value;
              }
            });

            if (results.every((r) => r && r.length > 10)) return results;
          }

          return null;
        },
        { timeout, polling: 25 },
        siteKeys.length,
      )
      .then((h) => h.jsonValue() as Promise<string[]>);

    isResolved = true;
    clickerActive = false;
    clearTimeout(cl);
    page.off("request", requestHandler);

    // If extractCdata is enabled, return cdata along with the token
    if (extractCdata) {
      const result: any = { token: tokens, cdata: capturedCdata, user_agent: userAgent };
      if (!Array.isArray(sitekey) && tokens.length === 1) {
        result.token = tokens[0];
      }
      return result;
    }

    if (!Array.isArray(sitekey) && tokens.length === 1) {
      return tokens[0];
    }

    return tokens;
  } catch (e) {
    isResolved = true;
    clickerActive = false;
    clearTimeout(cl);
    page.off("request", requestHandler);
    throw e;
  }
}

export default turnstile;

export interface ClickerOptions {
  page: any;
  startTime: number;
  onSuccess: (result: { cf_clearance: string; user_agent: string; elapsed: string }) => void;
}

export function startClicker(options: ClickerOptions): { stop: () => void } {
  const { page, startTime, onSuccess } = options;
  let clickerInterval: any = null;
  let attempts = 0;
  let stopped = false;
  let lastClickTime = 0;

  clickerInterval = setInterval(async () => {
    if (stopped || page.isClosed()) {
      clearInterval(clickerInterval);
      return;
    }

    try {
      const cookies = await page.cookies().catch(() => []);
      const cfCookie = cookies.find((c: any) => c.name === "cf_clearance");
      if (cfCookie) {
        const cf_clearance = cfCookie.value;
        const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => "");
        const elapsedTime = (Date.now() - startTime) / 1000;
        if (!stopped) {
          stopped = true;
          clearInterval(clickerInterval);
          onSuccess({
            cf_clearance,
            user_agent: userAgent,
            elapsed: elapsedTime.toFixed(2) + "s",
          });
          return;
        }
      }
    } catch (cookieErr: any) {}

    attempts++;
    if (attempts > 240) {
      clearInterval(clickerInterval);
      return;
    }

    const now = Date.now();
    if (now - lastClickTime < 250) return;

    try {
      const clickTarget = await page.evaluate((): { x: number; y: number } | null => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[name="cf-turnstile-response"]');
        for (const input of inputs) {
          const parent = input.parentElement;
          if (!parent) continue;
          const rect = parent.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0)
            return { x: rect.x + 30, y: rect.y + rect.height / 2 };
        }
        const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="challenges.cloudflare.com"]');
        for (const iframe of iframes) {
          const rect = iframe.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0)
            return { x: rect.x + 30, y: rect.y + rect.height / 2 };
        }
        return null;
      }).catch(() => null);

      if (clickTarget) {
        lastClickTime = Date.now();
        await page.mouse.click(clickTarget.x, clickTarget.y).catch(() => {});
      }
    } catch (e) {}
  }, 250);

  return {
    stop: () => {
      stopped = true;
      clearInterval(clickerInterval);
    },
  };
}