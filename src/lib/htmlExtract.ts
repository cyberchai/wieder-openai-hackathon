const SHOPIFY_HINTS = [/shopify/i, /x-shopify-stage/i, /window\.Shopify/];
const WOO_HINTS = [/woocommerce/i, /wp-content/i, /woocommerce_params/];
const SQUARE_HINTS = [/squareup/i, /__square/];
const TOAST_HINTS = [/toasttab/i, /x-toast-/i];

export function detectPlatform(html: string): "shopify" | "woocommerce" | "square" | "toast" | "unknown" {
  const body = html || "";
  const checks: [RegExp[], "shopify" | "woocommerce" | "square" | "toast"][] = [
    [SHOPIFY_HINTS, "shopify"],
    [WOO_HINTS, "woocommerce"],
    [SQUARE_HINTS, "square"],
    [TOAST_HINTS, "toast"],
  ];
  for (const [patterns, label] of checks) {
    if (patterns.some((rx) => rx.test(body))) {
      return label;
    }
  }
  return "unknown";
}

export function extractJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const json = match[1]?.trim();
    if (!json) continue;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      try {
        const cleaned = json.replace(/\,\s*\]/g, "]");
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          results.push(parsed);
        }
      } catch {
        // ignore malformed blocks
      }
    }
  }
  return results;
}

export function titleFrom(html: string): string {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html || "");
  if (match) return match[1].trim();
  const h1 = /<h1[^>]*>([^<]+)<\/h1>/i.exec(html || "");
  if (h1) return h1[1].trim();
  return "Merchant";
}
