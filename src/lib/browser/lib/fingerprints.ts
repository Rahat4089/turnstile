import { Page } from "puppeteer";
import deviceProfiles from "./devices.json" with { type: "json" };

export interface DeviceProfile {
  name: string;
  model: string;
  width: number;
  height: number;
  devicePixelRatio: number;
  videoCard: { renderer: string; vendor: string };
  oscpu: string;
  platform: string;
  notBrand: { name: string; version: string };
}

type HeaderMap = Record<string, string>;

interface UserAgentBrandVersion {
  brand: string;
  version: string;
}

interface UserAgentData {
  brands: UserAgentBrandVersion[];
  mobile: boolean;
  platform: string;
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
  uaFullVersion?: string;
  fullVersionList?: UserAgentBrandVersion[];
}

interface NavigatorFingerprint {
  userAgent: string;
  userAgentData?: UserAgentData;
  language: string;
  languages: string[];
  platform: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  maxTouchPoints?: number;
  product?: string;
  productSub?: string;
  vendor?: string;
  vendorSub?: string;
  doNotTrack?: string | null;
  appCodeName?: string;
  appName?: string;
  appVersion?: string;
  oscpu?: string;
  webdriver?: boolean | string;
  extraProperties?: Record<string, unknown>;
}

interface ScreenFingerprint {
  availLeft?: number;
  availTop?: number;
  width: number;
  height: number;
  availWidth?: number;
  availHeight?: number;
  clientWidth?: number;
  clientHeight?: number;
  hasHDR?: boolean;
  colorDepth?: number;
  pixelDepth?: number;
  pageXOffset?: number;
  pageYOffset?: number;
  outerWidth?: number;
  outerHeight?: number;
  innerWidth?: number;
  innerHeight?: number;
  screenX?: number;
  screenY?: number;
  devicePixelRatio?: number;
}

interface VideoCardFingerprint {
  renderer: string;
  vendor: string;
}

interface BrowserFingerprint {
  navigator: NavigatorFingerprint;
  screen: ScreenFingerprint;
  videoCard?: VideoCardFingerprint;
  audioCodecs?: Record<string, string>;
  videoCodecs?: Record<string, string>;
  pluginsData?: Record<string, unknown>;
  multimediaDevices?: unknown[];
  fonts?: string[];
  mockWebRTC?: boolean;
  slim?: boolean;
  battery?: Record<string, unknown>;
}

export interface BrowserFingerprintWithHeaders {
  fingerprint: BrowserFingerprint;
  headers: HeaderMap;
}

interface NormalizedBrowserFingerprint extends BrowserFingerprint {
  userAgent: string;
  historyLength: number;
}

export function fingerprints(mode?: string): BrowserFingerprintWithHeaders {
  if (mode !== "turnstile") {
    // Return original static Pixel 9 Pro profile for IUAM mode
    return {
      fingerprint: {
        navigator: {
          userAgent:
            "Mozilla/5.0 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
          userAgentData: {
            brands: [
              { brand: "Chromium", version: "148" },
              { brand: "Google Chrome", version: "148" },
              { brand: "Not(A:Brand", version: "99" },
            ],
            mobile: true,
            platform: "Android",
            platformVersion: "16.0.0",
            architecture: "",
            bitness: "",
            model: "Pixel 9 Pro",
            uaFullVersion: "148.0.0.0",
            fullVersionList: [
              { brand: "Chromium", version: "148.0.0.0" },
              { brand: "Google Chrome", version: "148.0.0.0" },
              { brand: "Not(A:Brand", version: "99.0.0.0" },
            ],
          },
          language: "en-US",
          languages: ["en-US"],
          platform: "Linux armv81",
          deviceMemory: 8,
          hardwareConcurrency: 8,
          maxTouchPoints: 5,
          product: "Gecko",
          productSub: "20030107",
          vendor: "Google Inc.",
          vendorSub: "",
          doNotTrack: "1",
          appCodeName: "Mozilla",
          appName: "Netscape",
          appVersion:
            "5.0 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
          oscpu: "Linux armv81",
          extraProperties: {
            vendorFlavors: ["chrome"],
            globalPrivacyControl: null,
            pdfViewerEnabled: false,
            installedApps: [],
            isBluetoothSupported: false,
          },
          webdriver: "false",
        },
        screen: {
          availLeft: 0,
          availTop: 0,
          width: 412,
          height: 915,
          availWidth: 412,
          availHeight: 915,
          clientWidth: 412,
          clientHeight: 915,
          hasHDR: true,
          colorDepth: 24,
          pixelDepth: 24,
          pageXOffset: 0,
          pageYOffset: 0,
          outerWidth: 412,
          outerHeight: 915,
          innerWidth: 412,
          innerHeight: 915,
          screenX: 0,
          screenY: 0,
          devicePixelRatio: 2.625,
        },
        videoCard: {
          renderer: "Adreno (TM) 740",
          vendor: "Qualcomm",
        },
        audioCodecs: {
          ogg: "probably",
          mp3: "probably",
          wav: "probably",
          m4a: "maybe",
          aac: "probably",
        },
        videoCodecs: {
          ogg: "",
          h264: "probably",
          webm: "probably",
        },
        pluginsData: {},
        multimediaDevices: [],
        fonts: ["sans-serif-thin"],
        mockWebRTC: false,
        slim: false,
        battery: {
          charging: "true",
          chargingTime: "0",
          dischargingTime: "Infinity",
          level: "1",
        },
      },
      headers: {
        "sec-ch-ua":
          '"Chromium";v="148", "Google Chrome";v="148", "Not(A:Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.5 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-fetch-site": "none",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
      },
    };
  }

  // Return dynamic random profile from 550 profiles for Turnstile mode
  const chromeVersions = [142, 143, 144, 145, 146];
  const chromeMajor =
    chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
  const buildNum = Math.floor(Math.random() * 1000) + 6000;
  const patchNum = Math.floor(Math.random() * 200);
  const chromeFull = `${chromeMajor}.0.${buildNum}.${patchNum}`;

  const androidMajor = Math.floor(Math.random() * 5) + 11;
  const platformVersion = `${androidMajor}.0.0`;

  const profile = (deviceProfiles as DeviceProfile[])[
    Math.floor(Math.random() * deviceProfiles.length)
  ];

  const userAgent = `Mozilla/5.0 (Linux; Android ${androidMajor}; ${profile.model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeFull} Mobile Safari/537.36`;
  const appVersion = `5.0 (Linux; Android ${androidMajor}; ${profile.model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeFull} Mobile Safari/537.36`;

  const brands: UserAgentBrandVersion[] = [
    { brand: "Chromium", version: `${chromeMajor}` },
    { brand: "Google Chrome", version: `${chromeMajor}` },
    { brand: profile.notBrand.name, version: profile.notBrand.version },
  ];

  const fullVersionList: UserAgentBrandVersion[] = [
    { brand: "Chromium", version: chromeFull },
    { brand: "Google Chrome", version: chromeFull },
    {
      brand: profile.notBrand.name,
      version: `${profile.notBrand.version}.0.0.0`,
    },
  ];

  const secChUa = brands.map((b) => `"${b.brand}";v="${b.version}"`).join(", ");

  console.log(
    `[Browser Launch] Applied dynamic device fingerprint for Turnstile: \x1b[36m${profile.name}\x1b[0m (Chrome ${chromeMajor}, Android ${androidMajor})`,
  );

  return {
    fingerprint: {
      navigator: {
        userAgent: userAgent,
        userAgentData: {
          brands: brands,
          mobile: true,
          platform: "Android",
          platformVersion: platformVersion,
          architecture: "",
          bitness: "",
          model: profile.model,
          uaFullVersion: chromeFull,
          fullVersionList: fullVersionList,
        },
        language: "en-US",
        languages: ["en-US"],
        platform: profile.platform,
        deviceMemory: 8,
        hardwareConcurrency: 8,
        maxTouchPoints: 5,
        product: "Gecko",
        productSub: "20030107",
        vendor: "Google Inc.",
        vendorSub: "",
        doNotTrack: "1",
        appCodeName: "Mozilla",
        appName: "Netscape",
        appVersion: appVersion,
        oscpu: profile.oscpu,
        extraProperties: {
          vendorFlavors: ["chrome"],
          globalPrivacyControl: null,
          pdfViewerEnabled: false,
          installedApps: [],
          isBluetoothSupported: false,
        },
        webdriver: "false",
      },
      screen: {
        availLeft: 0,
        availTop: 0,
        width: profile.width,
        height: profile.height,
        availWidth: profile.width,
        availHeight: profile.height,
        clientWidth: profile.width,
        clientHeight: profile.height,
        hasHDR: true,
        colorDepth: 24,
        pixelDepth: 24,
        pageXOffset: 0,
        pageYOffset: 0,
        outerWidth: profile.width,
        outerHeight: profile.height,
        innerWidth: profile.width,
        innerHeight: profile.height,
        screenX: 0,
        screenY: 0,
        devicePixelRatio: profile.devicePixelRatio,
      },
      videoCard: profile.videoCard,
      audioCodecs: {
        ogg: "probably",
        mp3: "probably",
        wav: "probably",
        m4a: "maybe",
        aac: "probably",
      },
      videoCodecs: { ogg: "", h264: "probably", webm: "probably" },
      pluginsData: {},
      multimediaDevices: [],
      fonts: ["sans-serif-thin"],
      mockWebRTC: false,
      slim: false,
      battery: {
        charging: "true",
        chargingTime: "0",
        dischargingTime: "Infinity",
        level: "1",
      },
    },
    headers: {
      "sec-ch-ua": secChUa,
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-ch-ua-platform-version": `"${platformVersion}"`,
      "sec-ch-ua-model": `"${profile.model}"`,
      "sec-ch-ua-full-version": `"${chromeFull}"`,
      "sec-ch-ua-full-version-list": fullVersionList
        .map((b) => `"${b.brand}";v="${b.version}"`)
        .join(", "),
      "upgrade-insecure-requests": "1",
      "user-agent": userAgent,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "sec-fetch-site": "none",
      "sec-fetch-mode": "navigate",
      "sec-fetch-user": "?1",
      "sec-fetch-dest": "document",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "en-US,en;q=0.9",
    },
  };
}

const REQUEST_SCOPED_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "cache-control",
  "pragma",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "upgrade-insecure-requests",
]);

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

function normalizeValue(value: unknown): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "Infinity") return Number.POSITIVE_INFINITY;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return value;
}

function normalizeRecord(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!record) return undefined;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key] = normalizeValue(value);
  }
  return normalized;
}

function normalizeFingerprint(
  browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
): NormalizedBrowserFingerprint {
  const { fingerprint } = browserFingerprintWithHeaders;
  return {
    ...fingerprint,
    navigator: {
      ...fingerprint.navigator,
      webdriver: normalizeValue(fingerprint.navigator.webdriver) as
        | boolean
        | string
        | undefined,
    },
    battery: normalizeRecord(fingerprint.battery),
    userAgent: fingerprint.navigator.userAgent,
    historyLength: randomInRange(2, 6),
  };
}

export function onlyInjectableHeaders(
  headers: HeaderMap,
  browserName?: string,
): HeaderMap {
  const filteredHeaders = { ...headers };
  for (const headerName of REQUEST_SCOPED_HEADERS) {
    delete filteredHeaders[headerName];
  }
  if (!(browserName?.toLowerCase().includes("firefox") ?? false)) {
    delete filteredHeaders.te;
  }
  return filteredHeaders;
}

function isMobileUserAgent(userAgent: string): boolean {
  return /phone|android|mobile/i.test(userAgent);
}

function installFingerprintOverrides(fingerprint: NormalizedBrowserFingerprint) {
  const browserWindow = window as any;
  const defineGetter = (
    instance: any,
    prototype: any,
    propertyName: string,
    value: any,
  ) => {
    const descriptor = {
      configurable: true,
      enumerable: true,
      get: () => value,
    };
    for (const target of [instance, prototype]) {
      if (!target) continue;
      try {
        Object.defineProperty(target, propertyName, descriptor);
        return;
      } catch {}
    }
  };
  const defineMethod = (
    instance: any,
    prototype: any,
    propertyName: string,
    method: any,
  ) => {
    const descriptor = {
      configurable: true,
      enumerable: false,
      writable: false,
      value: method,
    };
    for (const target of [instance, prototype]) {
      if (!target) continue;
      try {
        Object.defineProperty(target, propertyName, descriptor);
        return;
      } catch {}
    }
  };
  const applyReadonlyValues = (instance: any, prototype: any, values: any) => {
    for (const [propertyName, value] of Object.entries(values)) {
      if (value === undefined) continue;
      defineGetter(instance, prototype, propertyName, value);
    }
  };
  const navigatorPrototype = Object.getPrototypeOf(window.navigator);
  const screenPrototype = Object.getPrototypeOf(window.screen);
  const historyPrototype = Object.getPrototypeOf(window.history);
  const {
    navigator,
    screen,
    videoCard,
    audioCodecs,
    videoCodecs,
    battery,
    historyLength,
  } = fingerprint;
  const {
    userAgentData,
    extraProperties,
    language,
    languages,
    ...navigatorValues
  } = navigator;
  applyReadonlyValues(window.navigator, navigatorPrototype, navigatorValues);
  defineGetter(window.navigator, navigatorPrototype, "language", language);
  defineGetter(window.navigator, navigatorPrototype, "languages", [
    ...languages,
  ]);
  if (extraProperties) {
    applyReadonlyValues(window.navigator, navigatorPrototype, extraProperties);
  }
  if (userAgentData) {
    const uaMetadata = {
      brands: userAgentData.brands ?? [],
      mobile: Boolean(userAgentData.mobile),
      platform: userAgentData.platform ?? "",
    };
    const uaDataObject = Object.freeze({
      ...uaMetadata,
      getHighEntropyValues: async (hints: string[] = []) => {
        const highEntropyValues: any = { ...uaMetadata };
        for (const hint of hints) {
          if (hint in userAgentData) {
            highEntropyValues[hint] = (userAgentData as any)[hint];
          }
        }
        return highEntropyValues;
      },
      toJSON: () => uaMetadata,
    });
    defineGetter(
      window.navigator,
      navigatorPrototype,
      "userAgentData",
      uaDataObject,
    );
  }
  applyReadonlyValues(window.screen, screenPrototype, {
    availLeft: screen.availLeft,
    availTop: screen.availTop,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    isExtended: false,
  });
  applyReadonlyValues(window, Object.getPrototypeOf(window), {
    devicePixelRatio: screen.devicePixelRatio,
    innerWidth: screen.innerWidth ?? screen.width,
    innerHeight: screen.innerHeight ?? screen.height,
    outerWidth: screen.outerWidth ?? screen.width,
    outerHeight: screen.outerHeight ?? screen.height,
    pageXOffset: screen.pageXOffset ?? 0,
    pageYOffset: screen.pageYOffset ?? 0,
    screenX: screen.screenX ?? 0,
    screenY: screen.screenY ?? 0,
  });
  defineGetter(window.history, historyPrototype, "length", historyLength);
  if (!browserWindow.chrome) {
    try {
      Object.defineProperty(browserWindow, "chrome", {
        configurable: true,
        enumerable: true,
        writable: false,
        value: { runtime: {} },
      });
    } catch {}
  }
  if (!window.navigator.plugins.length) {
    const plugin = {
      name: "Chromium PDF Plugin",
      filename: "internal-pdf-viewer",
      description: "Portable Document Format",
    };
    const plugins = [plugin];
    const pluginArray = Object.assign([...plugins], {
      item: (index: number) => plugins[index] ?? null,
      namedItem: (name: string) =>
        plugins.find((candidate) => candidate.name === name) ?? null,
      refresh: () => undefined,
    });
    defineGetter(window.navigator, navigatorPrototype, "plugins", pluginArray);
    defineGetter(window.navigator, navigatorPrototype, "mimeTypes", []);
  }
  if (battery) {
    defineMethod(
      window.navigator,
      navigatorPrototype,
      "getBattery",
      async () => battery,
    );
  }
  if (videoCard) {
    const patchWebGl = (prototype: any) => {
      if (!prototype) return;
      const originalGetParameter = prototype.getParameter;
      if (typeof originalGetParameter !== "function") return;
      defineMethod(prototype, null, "getParameter", function (this: any, parameter: number) {
        const debugInfo = this.getExtension("WEBGL_debug_renderer_info");
        const vendorKey = debugInfo?.UNMASKED_VENDOR_WEBGL ?? 37445;
        const rendererKey = debugInfo?.UNMASKED_RENDERER_WEBGL ?? 37446;
        if (parameter === vendorKey) return videoCard.vendor;
        if (parameter === rendererKey) return videoCard.renderer;
        return originalGetParameter.call(this, parameter);
      });
    };
    patchWebGl((globalThis as any).WebGLRenderingContext?.prototype ?? null);
    patchWebGl((globalThis as any).WebGL2RenderingContext?.prototype ?? null);
  }
  if (audioCodecs || videoCodecs) {
    const codecStateByMimeType = new Map<string, string>();
    for (const [codecName, codecState] of Object.entries(audioCodecs ?? {}))
      codecStateByMimeType.set(`audio/${codecName}`, codecState);
    for (const [codecName, codecState] of Object.entries(videoCodecs ?? {}))
      codecStateByMimeType.set(`video/${codecName}`, codecState);
    const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;
    if (typeof originalCanPlayType === "function") {
      defineMethod(
        HTMLMediaElement.prototype,
        null,
        "canPlayType",
        function (this: HTMLMediaElement, mimeType: string) {
          const normalizedMimeType = String(mimeType || "")
            .split(";")[0]
            .trim();
          const override = codecStateByMimeType.get(normalizedMimeType);
          if (override) return override;
          if (
            normalizedMimeType === "video/mp4" &&
            String(mimeType).includes("avc1.42E01E")
          )
            return "probably";
          return originalCanPlayType.call(this, mimeType);
        },
      );
    }
  }
  defineGetter(
    window,
    Object.getPrototypeOf(window),
    "SharedArrayBuffer",
    undefined,
  );
}

export async function attachFingerprintToPage(
  page: Page,
  browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
) {
  const normalizedFingerprint = normalizeFingerprint(
    browserFingerprintWithHeaders,
  );
  const browserVersion = await page.browser().version();
  await page.setUserAgent(normalizedFingerprint.userAgent);
  await page.setViewport({
    width: normalizedFingerprint.screen.width,
    height: normalizedFingerprint.screen.height,
    deviceScaleFactor: normalizedFingerprint.screen.devicePixelRatio ?? 1,
    isMobile: isMobileUserAgent(normalizedFingerprint.userAgent),
    hasTouch: (normalizedFingerprint.navigator.maxTouchPoints ?? 0) > 0,
    isLandscape:
      normalizedFingerprint.screen.width > normalizedFingerprint.screen.height,
  });
  await page.setExtraHTTPHeaders(
    onlyInjectableHeaders(
      browserFingerprintWithHeaders.headers,
      browserVersion,
    ),
  );
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: "dark" },
  ]);
  await page.evaluateOnNewDocument(
    installFingerprintOverrides,
    normalizedFingerprint as any,
  );
}
