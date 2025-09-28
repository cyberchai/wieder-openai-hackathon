import { URL } from "url";
import type { BrowserContext, Page, ElementHandle } from "playwright";
import { withBrowser, autoScroll, isJsonResponse } from "@/src/lib/pwSniff";
import { harvestMenu, RawCapture } from "@/src/lib/menuExtract";
import { extractJsonLd, titleFrom } from "@/src/lib/htmlExtract";

const REQUIRED_SELECTORS = [
  "button.add",
  "button.checkout",
  "field.name",
  "field.phone",
  "field.time",
  "confirm.orderSummary",
];

async function safeFetch(url: string, init?: RequestInit, timeoutMs = 5000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

export async function robotsInfo(baseUrl: string): Promise<{ allowed: boolean; sitemaps: string[] }> {
  const robotsUrl = new URL("/robots.txt", baseUrl).toString();
  const res = await safeFetch(robotsUrl, undefined, 4000);
  if (!res || !res.ok) {
    return { allowed: true, sitemaps: [] };
  }
  const text = await res.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const sitemaps: string[] = [];
  let allowed = true;
  let inGlobal = false;
  for (const line of lines) {
    if (/^user-agent:\s*\*/i.test(line)) {
      inGlobal = true;
      continue;
    }
    if (/^user-agent:/i.test(line)) {
      inGlobal = false;
    }
    if (/^sitemap:/i.test(line)) {
      const url = line.split(/:\s*/i)[1];
      if (url) sitemaps.push(url.trim());
    }
    if (inGlobal && /^disallow:\s*\//i.test(line)) {
      allowed = false;
    }
  }
  return { allowed, sitemaps };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function selectorForHandle(handle: ElementHandle<Element> | null): Promise<string | null> {
  if (!handle) return null;
  try {
    return await handle.evaluate((el) => {
      const element = el as HTMLElement;
      if (!element) return null;
      if (element.id) return `#${CSS.escape(element.id)}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid='${testId}']`;
      const nameAttr = element.getAttribute("name");
      if (nameAttr) return `${element.tagName.toLowerCase()}[name='${nameAttr}']`;
      const classes = element.classList ? Array.from(element.classList) : [];
      if (classes.length) {
        return `${element.tagName.toLowerCase()}.${classes.map((c) => CSS.escape(c)).join(".")}`;
      }
      return element.tagName.toLowerCase();
    });
  } catch {
    return null;
  }
}

async function probeSelectors(page: Page): Promise<Record<string, string>> {
  const selectors: Record<string, string> = {};

  const addHandle = await page
    .locator("[data-testid*='add']")
    .first()
    .or(page.locator("button:has-text('add to cart')"))
    .or(page.locator("button:has-text('add')"))
    .elementHandle()
    .catch(() => null);
  const addSelector = await selectorForHandle(addHandle);
  if (addSelector) selectors["button.add"] = addSelector;

  const checkoutHandle = await page
    .locator("[data-testid*='checkout']")
    .first()
    .or(page.locator("a:has-text('checkout')"))
    .or(page.locator("button:has-text('checkout')"))
    .elementHandle()
    .catch(() => null);
  const checkoutSelector = await selectorForHandle(checkoutHandle);
  if (checkoutSelector) selectors["button.checkout"] = checkoutSelector;

  const nameHandle = await page.getByLabel(/name/i).elementHandle().catch(() => null);
  const nameSelector = await selectorForHandle(nameHandle);
  if (nameSelector) selectors["field.name"] = nameSelector;

  const phoneHandle = await page.getByLabel(/phone/i).elementHandle().catch(() => null);
  const phoneSelector = await selectorForHandle(phoneHandle);
  if (phoneSelector) selectors["field.phone"] = phoneSelector;

  const timeHandle = await page.getByLabel(/pick\s*up|time/i).elementHandle().catch(() => null);
  const timeSelector = await selectorForHandle(timeHandle);
  if (timeSelector) selectors["field.time"] = timeSelector;

  const summaryHandle = await page
    .locator("[data-testid*='summary']")
    .first()
    .or(page.locator("[id*='summary']"))
    .or(page.locator("[class*='summary']"))
    .or(page.locator("text=/order|cart|summary/i"))
    .elementHandle()
    .catch(() => null);
  const summarySelector = await selectorForHandle(summaryHandle);
  if (summarySelector) selectors["confirm.orderSummary"] = summarySelector;

  return selectors;
}

export async function buildDraftConfig(
  baseUrl: string,
  options?: { headers?: Record<string, string>; maxUrls?: number },
) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const robots = await robotsInfo(normalizedBase);
  if (!robots.allowed) {
    return { ok: false as const, reason: "robots-disallow", missingSelectors: [], draft: null, capturedCount: 0 };
  }

  const captures: RawCapture[] = [];
  let html = "";
  let selectors: Record<string, string> = {};
  let pageTitle = "";

  await withBrowser(async (ctx: BrowserContext) => {
    const page = await ctx.newPage();
    if (options?.headers) await page.setExtraHTTPHeaders(options.headers);

    let totalBytes = 0;
    const maxBytes = 5_000_000;
    page.on("response", async (res) => {
      try {
        if (!isJsonResponse(res)) return;
        if (options?.maxUrls && captures.length >= options.maxUrls) return;
        const body = await res.json().catch(() => null);
        if (!body) return;
        const size = JSON.stringify(body).length;
        if (totalBytes + size > maxBytes) return;
        totalBytes += size;
        captures.push({ url: res.url(), body });
      } catch {
        // ignore individual response failures
      }
    });

    await page.goto(normalizedBase, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await autoScroll(page, 10, 300).catch(() => {});

    html = await page.content();
    pageTitle = titleFrom(html) || new URL(normalizedBase).hostname;
    selectors = await probeSelectors(page);
  });

  const menuFromJson = harvestMenu(captures);
  let items = menuFromJson.items;

  if (!items.length) {
    const jsonLdObjects = extractJsonLd(html);
    const names = new Set<string>();
    jsonLdObjects.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const obj = entry as Record<string, unknown>;
      const rawType = obj["@type"];
      const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
      if (types.some((t) => typeof t === "string" && /Product|MenuItem|MenuSection/i.test(t))) {
        if (typeof obj.name === "string") names.add(obj.name);
        const hasMenuItem = obj.hasMenuItem;
        if (Array.isArray(hasMenuItem)) {
          hasMenuItem.forEach((item) => {
            if (item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string") {
              names.add((item as Record<string, unknown>).name as string);
            }
          });
        }
        const menuItems = obj.menuItems;
        if (Array.isArray(menuItems)) {
          menuItems.forEach((item) => {
            if (item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string") {
              names.add((item as Record<string, unknown>).name as string);
            }
          });
        }
      }
    });
    if (names.size) {
      items = Array.from(names).slice(0, 10).map((name) => ({ name, aliases: [], sizes: ["Tall", "Grande", "Venti"], modifiers: ["Oat Milk", "Almond Milk"] }));
    }
  }

  if (!items.length) {
    const fallback = ["Latte", "Coffee", "Espresso"];
    items = fallback.map((name) => ({ name, aliases: [], sizes: ["Tall", "Grande", "Venti"], modifiers: ["Oat Milk", "Almond Milk"] }));
  }

  // Suggest selectors for items/sizes/modifiers if missing
  items.slice(0, 30).forEach((item) => {
    const key = `item.${item.name.toLowerCase()}`;
    if (!selectors[key]) selectors[key] = `[data-testid*='${slugify(item.name)}']`;
  });

  const sizeSet = new Set<string>();
  items.forEach((item) => (item.sizes || []).forEach((s) => sizeSet.add(s)));
  Array.from(sizeSet).slice(0, 10).forEach((size) => {
    const key = `size.${size.toLowerCase()}`;
    if (!selectors[key]) selectors[key] = `[data-testid*='${slugify(size)}']`;
  });

  const modSet = new Set<string>();
  items.forEach((item) => (item.modifiers || []).forEach((m) => modSet.add(m)));
  Array.from(modSet).slice(0, 20).forEach((mod) => {
    const key = `modifier.${mod.toLowerCase()}`;
    if (!selectors[key]) selectors[key] = `[data-testid*='${slugify(mod)}']`;
  });

  const missingSelectors = REQUIRED_SELECTORS.filter((key) => !selectors[key]);
  if (!selectors["confirm.orderSummary"]) selectors["confirm.orderSummary"] = "[data-testid='order-summary']";

  const draft = {
    name: pageTitle,
    baseUrl: normalizedBase,
    selectors,
    menu: { items },
    normalize: { items: {}, sizes: {}, modifiers: {} },
    availability: {},
    verification: { summarySelector: selectors["confirm.orderSummary"] },
    checkout: {
      defaults: { name: "Guest", phone: "555-0101", time: "12:30" },
      fields: {
        name: selectors["field.name"] || "",
        phone: selectors["field.phone"] || "",
        time: selectors["field.time"] || "",
      },
    },
  };

  return {
    ok: true as const,
    draft,
    missingSelectors,
    capturedCount: captures.length,
  };
}
