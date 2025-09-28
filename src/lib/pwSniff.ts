import { chromium, BrowserContext, Page, Response } from "playwright";

export async function withBrowser<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    return await fn(context);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

export async function autoScroll(page: Page, steps = 8, delayMs = 250) {
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(delayMs);
  }
}

export function isJsonResponse(res: Response): boolean {
  const ct = res.headers()["content-type"] || "";
  return ct.includes("application/json") || ct.includes("+json");
}
