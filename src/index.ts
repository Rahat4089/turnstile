import iuam from "./lib/ends/iuam.ts";
import turnstile from "./lib/ends/turnstile.ts";
import { initBrowser, getPage, releasePage } from "./lib/browser/index.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Parse a proxy URL string into a structured proxy object.
 * Supported formats:
 *   host:port:username:password
 *   protocol://username:password@host:port
 *   protocol://host:port:username:password
 *   host:port (no auth)
 */
function parseProxyUrl(proxyUrl: string): { protocol: string; host: string; port: number | string; username?: string; password?: string } {
  // If already an object, return as-is (shouldn't happen here but safety)
  if (typeof proxyUrl !== "string") return proxyUrl as any;

  // Format: protocol://username:password@host:port
  const urlMatch = proxyUrl.match(/^(https?|socks[45]?):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);
  if (urlMatch) {
    return { protocol: urlMatch[1], host: urlMatch[4], port: urlMatch[5], username: urlMatch[2], password: urlMatch[3] };
  }

  // Format: protocol://host:port:username:password
  const protoMatch = proxyUrl.match(/^(https?|socks[45]?):\/\/(.+)$/);
  if (protoMatch) {
    const parts = protoMatch[2].split(":");
    if (parts.length === 4) return { protocol: protoMatch[1], host: parts[0], port: parts[1], username: parts[2], password: parts[3] };
    if (parts.length === 2) return { protocol: protoMatch[1], host: parts[0], port: parts[1] };
  }

  // Format: host:port:username:password
  const parts = proxyUrl.split(":");
  if (parts.length === 4) return { protocol: "http", host: parts[0], port: parts[1], username: parts[2], password: parts[3] };
  if (parts.length === 2) return { protocol: "http", host: parts[0], port: parts[1] };

  throw new Error(`Invalid proxy URL format: ${proxyUrl}`);
}

const port = Number(process.env.PORT) || 8742;

(global as any).browserLimit = Number(process.env.browserLimit) || 500;
(global as any).timeOut = Number(process.env.timeOut) || 60000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_JS_URL =
  "https://challenges.cloudflare.com/turnstile/v0/g/825e783f7fae/api.js?onload=GHkYU6&render=explicit";
const API_TXT_PATH = path.resolve(__dirname, "./lib/browser/lib/js/api.txt");
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function updateTurnstileScript() {
  try {
    console.log(`[Updater] Fetching Turnstile script...`);
    const response = await fetch(API_JS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text || text.trim().length === 0) throw new Error("Empty script");
    const dir = path.dirname(API_TXT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(API_TXT_PATH, text, "utf8");
    console.log(`[Updater] Turnstile script updated.`);
    return true;
  } catch (error: any) {
    console.error("[Updater] Update failed:", error.message);
    return false;
  }
}

async function startAutoUpdater() {
  await updateTurnstileScript();
  setInterval(updateTurnstileScript, UPDATE_INTERVAL_MS);
}

startAutoUpdater()
  .then(() => console.log("[System] Auto-updater initialized"))
  .catch((err) => console.error("[System] Auto-updater failed", err));

// Pre-warm the shared browser and fill the page pool at startup so the first
// request never has to pay the cold-start cost of launching Chrome.
initBrowser()
  .then(() => console.log("[System] Browser pre-warmed"))
  .catch((err) => console.error("[System] Browser pre-warm failed:", err));

const server = Bun.serve({
  port,
  idleTimeout: Math.floor((global as any).timeOut / 1000),
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/cloudflare") {
      const startTime = Date.now();
      let data: any;
      try {
        data = await req.json();
      } catch {
        return Response.json(
          { message: "Bad Request: invalid JSON" },
          { status: 400 },
        );
      }

      if (!data || typeof data.mode !== "string") {
        return Response.json(
          { message: "Bad Request: missing or invalid mode" },
          { status: 400 },
        );
      }

      if ((global as any).browserLimit <= 0) {
        return Response.json({ message: "Too Many Requests" }, { status: 429 });
      }

      (global as any).browserLimit--;
      let result: any;
      let page: any;

      const abortHandler = () => {
        if (page) {
          console.log("Client disconnected, closing page");
          releasePage(page);
          page = null;
        }
      };
      req.signal.addEventListener("abort", abortHandler);

      try {
        // Parse proxy_url string into proxy object if provided
      if (data.proxy_url && !data.proxy) {
        try {
          data.proxy = parseProxyUrl(data.proxy_url);
        } catch (e: any) {
          return Response.json({ message: e.message, success: false }, { status: 400 });
        }
      }

      if (data.mode === "iuam") {
          page = await getPage({ newPage: true, proxy: data.proxy, mode: "iuam" });
          result = await iuam(data as any, page)
            .then((r: any) => {
              const { cf_clearance, user_agent } = r;
              if (!cf_clearance)
                return {
                  code: 500,
                  message: "Failed to obtain cf_clearance token",
                  success: false,
                };
              return {
                headers: {
                  Cookie: `cf_clearance=${cf_clearance};`,
                  "User-Agent": user_agent,
                },
                user_agent,
                success: true,
              };
            })
            .catch((err) => ({
              code: 500,
              message: err.message,
              success: false,
            }));
        } else if (data.mode === "turnstile") {
          page = await getPage({ proxy: data.proxy, mode: "turnstile" });
          result = await turnstile(data as any, page)
            .then((response: any) => {
              // Handle both simple token response and cdata extraction response
              if (response && typeof response === "object" && response.user_agent !== undefined) {
                const res: any = { token: response.token, user_agent: response.user_agent, success: true };
                if (response.cdata !== undefined) res.cdata = response.cdata;
                return res;
              }
              return { token: response, success: true };
            })
            .catch(async (err: any) => {
              let message = err.message;
              if (
                message.includes("Waiting failed") ||
                message.includes("timeout")
              ) {
                message = "fail to solve this challenge";
              }
              return { code: 500, message, success: false };
            });
        } else {
          result = { code: 400, message: "Invalid mode", success: false };
        }
      } catch (err: any) {
        result = { code: 500, message: err.message, success: false };
      } finally {
        req.signal.removeEventListener("abort", abortHandler);
        if (page) {
          await releasePage(page);
        }
        (global as any).browserLimit++;
      }

      if (!result.elapsed) {
        result.elapsed = ((Date.now() - startTime) / 1000).toFixed(2) + "s";
      }

      const finalResult: any = {};
      if ("token" in result) finalResult.token = result.token;
      if ("cdata" in result) finalResult.cdata = result.cdata;
      if ("headers" in result) finalResult.headers = result.headers;
      if ("user_agent" in result) finalResult.user_agent = result.user_agent;
      if ("code" in result) finalResult.code = result.code;
      if ("message" in result) finalResult.message = result.message;
      finalResult.elapsed = result.elapsed;
      if ("success" in result) finalResult.success = result.success;

      return Response.json(finalResult, { status: result.code ?? 200 });
    }

    return Response.json({ message: "Not Found" }, { status: 404 });
  },
});

console.log(`Server running on port ${server.port}`);
