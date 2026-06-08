import { anonymizeProxy, closeAnonymizedProxy } from "proxy-chain";

export interface ProxyOptions {
  protocol: string;
  host: string;
  port: number | string;
  username?: string;
  password?: string;
}

const activeProxies = new Map<string, string>();

export async function createLocalProxy(proxy: ProxyOptions): Promise<string> {
  const { protocol, host, port, username, password } = proxy;

  let credentials = "";
  if (username && password) {
    credentials = `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
  }

  const targetProxyUrl = `${protocol}://${credentials}${host}:${port}`;

  if (activeProxies.has(targetProxyUrl)) {
    return activeProxies.get(targetProxyUrl)!;
  }

  const localProxyUrl = await anonymizeProxy(targetProxyUrl);

  activeProxies.set(targetProxyUrl, localProxyUrl);
  return localProxyUrl;
}

export async function closeLocalProxy(targetUrl: string): Promise<void> {
  const localUrl = activeProxies.get(targetUrl);
  if (localUrl) {
    try {
      await closeAnonymizedProxy(localUrl, true);
      activeProxies.delete(targetUrl);
    } catch (e) {
      console.error(`Failed to close local proxy for ${targetUrl}:`, e);
    }
  }
}

export async function closeAllLocalProxies(): Promise<void> {
  const closePromises: Promise<any>[] = [];
  for (const [targetUrl, localUrl] of activeProxies.entries()) {
    closePromises.push(
      closeAnonymizedProxy(localUrl, true).catch((e) => {
        console.error(`Failed to close local proxy for ${targetUrl}:`, e);
      }),
    );
  }
  await Promise.all(closePromises);
  activeProxies.clear();
}
