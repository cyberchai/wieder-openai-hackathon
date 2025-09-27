import { chromium } from "playwright";
import type { Page } from "playwright";
import fs from "fs";
import path from "path";

type OrderItem = { name: string; size?: string; modifiers?: string[]; qty?: number };
type Plan = {
  items: OrderItem[];
  fulfillment?: { type: "pickup" | "delivery"; time?: string };
  customer?: { name?: string; phone?: string };
  payment?: { type: string };
};
type Config = {
  baseUrl: string;
  selectors: Record<string, string>;
  normalize?: {
    items?: Record<string, string>;
    sizes?: Record<string, string>;
    modifiers?: Record<string, string>;
  };
  availability?: {
    outOfStock?: string[];
    substitutions?: Record<string, string[]>;
  };
  verification?: { summarySelector: string };
  checkout?: {
    defaults?: { name?: string; phone?: string; time?: string };
    fields?: { name?: string; phone?: string; time?: string };
  };
  menu?: {
    items: { name: string; aliases?: string[] }[];
  };
};

function getChromePath() {
  return chromium.executablePath();
}

function loadJSON<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sel(cfg: Config, key: string) {
  const s = cfg.selectors[key];
  if (!s) throw new Error(`Missing selector for "${key}"`);
  return s;
}

function resolveItemKey(cfg: Config, rawName: string): string | null {
  const n = (rawName || "").toLowerCase().trim();
  if (!n) return null;

  const viaNorm = cfg.normalize?.items?.[n];
  if (viaNorm && cfg.selectors[`item.${viaNorm}`]) return `item.${viaNorm}`;
  if (cfg.selectors[`item.${n}`]) return `item.${n}`;

  const items = cfg.menu?.items;
  if (items?.length) {
    for (const it of items) {
      const canon = it.name.toLowerCase();
      const key = `item.${canon}`;
      if (!cfg.selectors[key]) continue;
      if (canon === n) return key;
      if (it.aliases?.some((a) => a.toLowerCase().trim() === n)) return key;
    }
  }

  const keys = Object.keys(cfg.selectors).filter((k) => k.startsWith("item."));
  const hit = keys.find((k) => k.includes(n));
  return hit ?? null;
}

function normalizeOne(map: Record<string, string> | undefined, v?: string) {
  if (!v) return v;
  const key = v.toLowerCase().trim();
  return map?.[key] ?? key;
}

async function click(page: Page, selector: string) {
  await page.waitForSelector(selector, { state: "visible" });
  await page.click(selector);
}

async function fill(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { state: "visible" });
  await page.fill(selector, value);
}

async function run(planPath: string, configPath: string) {
  const plan = loadJSON<Plan>(planPath);
  const cfg = loadJSON<Config>(configPath);

  const userDataDir = path.join(process.cwd(), ".chrome-profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: getChromePath(),
    recordVideo: { dir: "videos" },
    viewport: { width: 1280, height: 800 },
    args: ["--start-maximized"],
  });
  const page = await context.newPage();

  console.log("[executor] Go to", cfg.baseUrl);
  await page.goto(cfg.baseUrl);

  for (const rawItem of plan.items) {
    const itemKey = resolveItemKey(cfg, rawItem.name || "");
    if (!itemKey) {
      console.log(
        `[executor] Could not find a button for "${rawItem.name}". Check config.normalize.items or menu.aliases.`,
      );
      continue;
    }

    const canonicalItem = itemKey.replace(/^item\./, "");
    const size = normalizeOne(cfg.normalize?.sizes, rawItem.size);
    const mods = (rawItem.modifiers ?? [])
      .map((m) => normalizeOne(cfg.normalize?.modifiers, m))
      .filter((m): m is string => Boolean(m));

    console.log(
      `[executor] Add ${size ? size + " " : ""}${canonicalItem}${mods.length ? " (" + mods.join(", ") + ")" : ""}`,
    );

    await click(page, sel(cfg, itemKey));

    if (size) {
      const sizeKey = `size.${size}`;
      if (cfg.selectors[sizeKey]) {
        await click(page, sel(cfg, sizeKey));
      } else {
        console.log(`[executor] No selector for size '${size}', skipping size click`);
      }
    }

    const out = new Set((cfg.availability?.outOfStock ?? []).map((o) => o.toLowerCase()));
    for (const m of mods) {
      if (!m) continue;
      if (out.has(m)) {
        const subs = cfg.availability?.substitutions?.[m] ?? [];
        const fallback = subs[0]?.toLowerCase();
        if (fallback && cfg.selectors[`modifier.${fallback}`]) {
          console.log(`[executor] '${m}' OOS → using '${fallback}'`);
          await click(page, sel(cfg, `modifier.${fallback}`));
        } else {
          console.log(`[executor] '${m}' OOS and no substitution; skipping`);
        }
        continue;
      }

      const modKey = `modifier.${m}`;
      if (cfg.selectors[modKey]) {
        await click(page, sel(cfg, modKey));
      } else {
        console.log(`[executor] No selector for modifier '${m}', skipping`);
      }
    }

    await click(page, sel(cfg, "button.add"));
  }

  if (cfg.selectors["button.viewCart"]) {
    await click(page, sel(cfg, "button.viewCart"));
  }
  await click(page, sel(cfg, "button.checkout"));

  const defaults = cfg.checkout?.defaults ?? {};
  const fields = cfg.checkout?.fields ?? {};
  const nameVal = plan.customer?.name || defaults.name || "Guest";
  const phoneVal = plan.customer?.phone || defaults.phone || "555-0101";
  const timeVal = plan.fulfillment?.time || defaults.time || "12:30";

  if (fields.name) await fill(page, sel(cfg, fields.name), nameVal);
  if (fields.phone) await fill(page, sel(cfg, fields.phone), phoneVal);
  if (fields.time) await fill(page, sel(cfg, fields.time), timeVal);

  const verifySel = cfg.verification?.summarySelector;
  if (verifySel) {
    const text = (await page.textContent(verifySel))?.toLowerCase() ?? "";
    let ok = true;
    for (const item of plan.items) {
      const resolvedKey = resolveItemKey(cfg, item.name || "");
      const n = resolvedKey ? resolvedKey.replace(/^item\./, "") : normalizeOne(cfg.normalize?.items, item.name) ?? "";
      const s = normalizeOne(cfg.normalize?.sizes, item.size) ?? "";
      const mods = (item.modifiers ?? [])
        .map((m) => normalizeOne(cfg.normalize?.modifiers, m) ?? m.toLowerCase())
        .filter((m): m is string => Boolean(m));

      if (n && !text.includes(n)) {
        console.log(`[verify] Missing item '${n}' in summary`);
        ok = false;
      }
      if (s && !text.includes(s)) {
        console.log(`[verify] Missing size '${s}' in summary`);
        ok = false;
      }
      for (const m of mods) {
        if (m && !text.includes(m)) {
          console.log(`[verify] Missing modifier '${m}' in summary`);
          ok = false;
        }
      }
    }
    console.log(ok ? "✅ Verification passed" : "⚠️ Verification had mismatches");
  }

  console.log("✅ Reached checkout (stopping before payment). Video saved in ./videos");
  await context.close();
}

function parseArgs(argv: string[]) {
  const entries: [string, string][] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      entries.push([key, value]);
    }
  }
  return Object.fromEntries(entries);
}

const args = parseArgs(process.argv.slice(2));
const planPath = args.plan ? path.resolve(args.plan) : path.resolve(".last-plan.json");
const configPath = args.config ? path.resolve(args.config) : path.resolve("merchant-configs/asaply-demo.json");

run(planPath, configPath).catch((error) => {
  console.error(error);
  process.exit(1);
});
