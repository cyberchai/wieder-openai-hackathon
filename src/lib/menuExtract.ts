export type RawCapture = { url: string; body: unknown };

export function harvestMenu(captures: RawCapture[]) {
  const candidates: unknown[] = [];
  for (const capture of captures) {
    const body = capture.body;
    if (!body || typeof body !== "object") continue;
    if (Array.isArray(body)) {
      candidates.push(body);
      continue;
    }
    const entries = Object.entries(body as Record<string, unknown>);
    for (const [key, value] of entries) {
      if (Array.isArray(value) && /(item|product|menu)/i.test(key)) {
        candidates.push(value);
      }
    }
  }

  const itemsMap = new Map<string, { name: string; sizes: string[]; modifiers: string[] }>();
  const addItem = (name: string, size?: string, modifier?: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    const entry = itemsMap.get(key) || { name, sizes: [], modifiers: [] };
    if (size) {
      const clean = cleanValue(size);
      if (clean && !entry.sizes.includes(clean)) entry.sizes.push(clean);
    }
    if (modifier) {
      const clean = cleanValue(modifier);
      if (clean && !entry.modifiers.includes(clean)) entry.modifiers.push(clean);
    }
    itemsMap.set(key, entry);
  };

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const raw of candidate) {
      if (!raw || typeof raw !== "object") continue;
      const record = raw as Record<string, unknown>;
      const name = pickString(record, ["name", "title", "productName", "itemName"]);
      if (!name) continue;

      const sizeValues = collectStrings(record, ["size", "variant", "volume"]);
      if (!sizeValues.length && Array.isArray(record.variants)) {
        (record.variants as unknown[]).forEach((variant) => {
          if (!variant || typeof variant !== "object") return;
          const variantName = pickString(variant as Record<string, unknown>, ["name", "title"]);
          if (variantName) sizeValues.push(variantName);
        });
      }

      const modifierValues = collectStrings(record, ["modifier", "option", "topping", "addOn"]);
      if (!modifierValues.length && Array.isArray(record.options)) {
        (record.options as unknown[]).forEach((option) => {
          if (!option || typeof option !== "object") return;
          const optionName = pickString(option as Record<string, unknown>, ["name", "title"]);
          if (optionName) modifierValues.push(optionName);
        });
      }

      if (!sizeValues.length && !modifierValues.length) {
        addItem(name);
      }
      sizeValues.forEach((size) => addItem(name, size));
      modifierValues.forEach((mod) => addItem(name, undefined, mod));
    }
  }

  const items = Array.from(itemsMap.values()).map((item) => ({
    name: item.name,
    aliases: [] as string[],
    sizes: uniqueClean(item.sizes),
    modifiers: uniqueClean(item.modifiers),
  }));

  const defaultSizes = ["Tall", "Grande", "Venti"];
  const defaultMods = ["Oat Milk", "Almond Milk", "Whole Milk", "Double Shot"];
  if (items.length) {
    const anySizes = items.some((item) => item.sizes.length);
    const anyMods = items.some((item) => item.modifiers.length);
    if (!anySizes) items.forEach((item) => (item.sizes = [...defaultSizes]));
    if (!anyMods) items.forEach((item) => (item.modifiers = [...defaultMods]));
  }

  return { items };
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function collectStrings(source: Record<string, unknown>, keys: string[]): string[] {
  const acc: string[] = [];
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) acc.push(value.trim());
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) acc.push(item.trim());
      }
    }
  }
  return uniqueClean(acc);
}

function uniqueClean(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => cleanValue(v)).filter(Boolean))) as string[];
}

function cleanValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
