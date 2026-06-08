import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { startClicker } from "./turnstile.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CloudflareData {
  url: string;
  proxy?: {
    protocol?: string;
    host: string;
    port: number | string;
    username?: string;
    password?: string;
  };
}

async function cloudflare(data: CloudflareData, page: any): Promise<any> {
  return new Promise(async (resolve, reject) => {
    if (!data.url) return reject(new Error("Missing url parameter"));

    const startTime = Date.now();
    let isResolved = false;
    const timeout = (global as any).timeOut || 60000;

    let clicker: any = null;

    const cl = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error("Timeout Error"));
      }
    }, timeout);

    const closeHandler = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(cl);
        cleanup();
        reject(new Error("Browser page was closed unexpectedly"));
      }
    };

    const cleanup = async () => {
      try {
        if (clicker) {
          clicker.stop();
        }
        page.off("request", requestHandler);
        page.off("response", responseHandler);
        page.off("close", closeHandler);
      } catch (e) { }
    };

    const requestHandler = async (req: any) => {
      if (req.isInterceptResolutionHandled()) return;

      try {
        const reqUrl = req.url();
        if (
          reqUrl.includes("challenges.cloudflare.com/turnstile") &&
          reqUrl.includes("/api.js")
        ) {
          const localPath = path.join(__dirname, "../browser/lib/js/api.txt");
          try {
            const body = fs.readFileSync(localPath);
            await req.respond({
              status: 200,
              contentType: "application/javascript",
              body: body,
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            });
          } catch (e) {
            console.error("Failed to serve local api.js:", e);
            await req.continue();
          }
        } else if (reqUrl.startsWith("chrome-extension://")) {
          await req.continue();
        } else if (
          reqUrl === data.url ||
          reqUrl.startsWith(new URL(data.url).origin) ||
          reqUrl.includes("challenges.cloudflare.com") ||
          reqUrl.includes("/cdn-cgi/challenge-platform/")
        ) {
          await req.continue();
        } else {
          await req.continue();
        }
      } catch (_) {
        if (!req.isInterceptResolutionHandled()) {
          try {
            await req.continue();
          } catch { }
        }
      }
    };

    const responseHandler = async (res: any) => {
      try {
        const url = res.url();
        if (url.includes("/cdn-cgi/challenge-platform/")) {
          const headers = res.headers();
          if (headers["set-cookie"]) {
            const setCookie = headers["set-cookie"];
            const match = setCookie.match(/cf_clearance=([^;]+)/);
            if (match) {
              const cf_clearance = match[1];
              const requestHeaders = res.request().headers();
              const userAgent = requestHeaders["user-agent"];
              const elapsedTime = (Date.now() - startTime) / 1000;

              if (!isResolved) {
                isResolved = true;
                clearTimeout(cl);
                cleanup();

                resolve({
                  cf_clearance,
                  user_agent: userAgent,
                  elapsed: elapsedTime.toFixed(2) + "s",
                });
              }
            }
          }
        }
      } catch (_) { }
    };

    try {
      try {
        const client = await page.target().createCDPSession();
        await client.send("Network.clearBrowserCookies");
      } catch (e) { }

      // Apply proxy authentication if provided
      if (data.proxy) {
        const proxyAuth = {
          username: data.proxy.username || "",
          password: data.proxy.password || "",
        };
        await page.authenticate(proxyAuth);
      }

      await page.setRequestInterception(true);
      page.on("request", requestHandler);
      page.on("response", responseHandler);
      page.on("close", closeHandler);

      clicker = startClicker({
        page,
        startTime,
        onSuccess: (res: any) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(cl);
            cleanup();
            resolve(res);
          }
        },
      });

      // Set proxy for page navigation if needed (Puppeteer launch args should handle proxy)
      // The proxy authentication above handles authenticated proxies
      await page.goto(data.url, {
        waitUntil: "domcontentloaded",
        timeout,
      });
    } catch (err) {
      console.error("[Setup] Unexpected error in iuam solver:", err);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(cl);
        cleanup();
        reject(err);
      }
    }
  });
}

export default cloudflare;