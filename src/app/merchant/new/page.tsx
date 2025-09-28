"use client";

import { useState } from "react";
import Papa from "papaparse";
import type { MerchantConfig } from "@/src/types/merchant";
import { auth } from "@/src/lib/firebaseClient";

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function splitMulti(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function NewMerchant() {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000/mock-cafe");
  const [itemsText, setItemsText] = useState("Matcha Latte\nCold Brew\nOat Latte");
  const [sizesText, setSizesText] = useState("Tall\nGrande\nVenti");
  const [modsText, setModsText] = useState("Oat Milk\nAlmond Milk\nWhole Milk\n2x Shots");
  const [msg, setMsg] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUrl, setCsvUrl] = useState("");
  const [csvCols, setCsvCols] = useState<string[]>([]);
  const [colMap, setColMap] = useState<{ name?: string; size?: string; modifier?: string }>({});
  const [csvRows, setCsvRows] = useState<Record<string, unknown>[]>([]);
  const [csvPreview, setCsvPreview] = useState<{ items: string[]; sizes: string[]; modifiers: string[] }>({
    items: [],
    sizes: [],
    modifiers: [],
  });

  async function readCsvFromFile(file: File): Promise<{ data: Record<string, unknown>[]; fields: string[] }> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data || [];
          const fields = results.meta.fields || Object.keys(rows[0] || {});
          resolve({ data: rows, fields });
        },
        error: (err: unknown) => reject(err),
      });
    });
  }

  async function readCsvFromUrl(url: string): Promise<{ data: Record<string, unknown>[]; fields: string[] }> {
    const resp = await fetch(url, { cache: "no-store" });
    const text = await resp.text();
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data || [];
          const fields = results.meta.fields || Object.keys(rows[0] || {});
          resolve({ data: rows, fields });
        },
        error: (err: unknown) => reject(err),
      });
    });
  }

  function autoMapColumns(fields: string[]) {
    const name = fields.find((field) => /name|item|product|title/i.test(field)) || "";
    const size = fields.find((field) => /size|variant|volume/i.test(field)) || "";
    const modifier = fields.find((field) => /modifier|option|add.?on|topping|syrup/i.test(field)) || "";
    return { name, size, modifier };
  }

  async function handleDetectColumns() {
    try {
      let parsed: { data: Record<string, unknown>[]; fields: string[] } | null = null;
      if (csvFile) parsed = await readCsvFromFile(csvFile);
      else if (csvUrl) parsed = await readCsvFromUrl(csvUrl);
      if (!parsed) {
        alert("Provide a CSV file or URL first.");
        return;
      }
      setCsvRows(parsed.data);
      setCsvCols(parsed.fields);
      const guess = autoMapColumns(parsed.fields);
      setColMap(guess);
      setMsg("Columns detected. Map the fields and parse.");
    } catch (error) {
      console.error(error);
      alert("Could not read CSV. Check format or CORS for URL.");
    }
  }

  function handleParseCsv() {
    if (!csvRows.length || !colMap.name) {
      alert("Detect columns first and select the Item name column.");
      return;
    }

    const itemNames: string[] = [];
    const sizeValues: string[] = [];
    const modifierValues: string[] = [];

    for (const row of csvRows) {
      const nameValue = String(row[colMap.name] ?? "").trim();
      if (!nameValue) continue;
      itemNames.push(nameValue);

      if (colMap.size) {
        const sizes = splitMulti(String(row[colMap.size] ?? ""));
        sizeValues.push(...sizes);
      }

      if (colMap.modifier) {
        const mods = splitMulti(String(row[colMap.modifier] ?? ""));
        modifierValues.push(...mods);
      }
    }

    const items = uniq(itemNames);
    const sizes = uniq(sizeValues);
    const modifiers = uniq(modifierValues);

    setCsvPreview({ items, sizes, modifiers });
    setMsg(`Parsed CSV with ${items.length} items.`);
  }

  function applyCsvToForm() {
    if (!csvPreview.items.length) {
      alert("Parse CSV first.");
      return;
    }

    const existingItems = itemsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const existingSizes = sizesText.split("\n").map((s) => s.trim()).filter(Boolean);
    const existingMods = modsText.split("\n").map((s) => s.trim()).filter(Boolean);

    const mergedItems = uniq([...existingItems, ...csvPreview.items]);
    const mergedSizes = uniq([...existingSizes, ...csvPreview.sizes]);
    const mergedModifiers = uniq([...existingMods, ...csvPreview.modifiers]);

    setItemsText(mergedItems.join("\n"));
    if (mergedSizes.length) setSizesText(mergedSizes.join("\n"));
    if (mergedModifiers.length) setModsText(mergedModifiers.join("\n"));

    setMsg(
      `Imported ${csvPreview.items.length} items` +
        (csvPreview.sizes.length ? `, ${csvPreview.sizes.length} sizes` : "") +
        (csvPreview.modifiers.length ? `, ${csvPreview.modifiers.length} modifiers` : ""),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      alert("Sign in first");
      return;
    }

    const items = itemsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const sizes = sizesText.split("\n").map((s) => s.trim()).filter(Boolean);
    const mods = modsText.split("\n").map((s) => s.trim()).filter(Boolean);

    const selectors: Record<string, string> = {
      "button.add": "[data-testid='add-to-cart']",
      "button.checkout": "[data-testid='checkout']",
      "field.name": "[data-testid='field-name']",
      "field.phone": "[data-testid='field-phone']",
      "field.time": "[data-testid='field-pickup-time']",
      "confirm.orderSummary": "[data-testid='order-summary']",
    };

    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    items.forEach((item) => {
      selectors[`item.${item.toLowerCase()}`] = `[data-testid='item-${slug(item)}']`;
    });
    sizes.forEach((size) => {
      selectors[`size.${size.toLowerCase()}`] = `[data-testid='size-${slug(size)}']`;
    });
    mods.forEach((mod) => {
      selectors[`modifier.${mod.toLowerCase()}`] = `[data-testid='mod-${slug(mod)}']`;
    });

    const cfg: Partial<MerchantConfig> = {
      name,
      baseUrl,
      selectors,
      menu: {
        items: items.map((item) => ({ name: item, aliases: [], sizes, modifiers: mods })),
      },
      normalize: { items: {}, sizes: {}, modifiers: {} },
      verification: { summarySelector: "[data-testid='order-summary']" },
      checkout: {
        defaults: { name: "Guest", phone: "555-0101", time: "12:30" },
        fields: { name: "field.name", phone: "field.phone", time: "field.time" },
      },
    };

    const val = await fetch("/api/merchants/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }).then((res) => res.json());

    if (!val.ok) {
      setMsg("Fix missing: " + (val.missing || []).join(", "));
      return;
    }

    const saved = await fetch("/api/merchants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cfg),
    }).then((res) => res.json());

    if (saved?.id) {
      if (typeof window !== "undefined") {
        localStorage.setItem("asaply.selectedMerchant", `firestore:${saved.id}`);
        localStorage.removeItem("asaply.selectedMerchantId");
      }
      window.location.href = `/merchant/${saved.id}`;
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">New Merchant</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="border p-2 w-full"
          placeholder="Merchant name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Base URL (e.g., http://localhost:3000/mock-cafe)"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <section className="border rounded p-3 space-y-3">
          <h2 className="font-medium">Import from CSV / Google Sheets</h2>
          <p className="text-xs text-gray-600">
            CSV columns supported: <code>name</code> (required), <code>size</code> (optional), <code>modifier</code> (optional).
            Sizes/modifiers can be separated by comma, semicolon, or pipe. Google Sheets: Publish to the web → CSV.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm block mb-1">Upload CSV file</label>
              <input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="text-sm block mb-1">CSV URL (Google Sheets “Publish to web” CSV)</label>
              <input
                className="border p-2 w-full"
                placeholder="https://docs.google.com/.../export?format=csv"
                value={csvUrl}
                onChange={(event) => setCsvUrl(event.target.value)}
              />
            </div>
          </div>

          {csvCols.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm block mb-1">Item name column</label>
                <select
                  className="border p-2 w-full"
                  value={colMap.name || ""}
                  onChange={(event) => setColMap({ ...colMap, name: event.target.value || undefined })}
                >
                  <option value="">-- Select --</option>
                  {csvCols.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1">Size column (optional)</label>
                <select
                  className="border p-2 w-full"
                  value={colMap.size || ""}
                  onChange={(event) => setColMap({ ...colMap, size: event.target.value || undefined })}
                >
                  <option value="">-- None --</option>
                  {csvCols.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1">Modifier column (optional)</label>
                <select
                  className="border p-2 w-full"
                  value={colMap.modifier || ""}
                  onChange={(event) => setColMap({ ...colMap, modifier: event.target.value || undefined })}
                >
                  <option value="">-- None --</option>
                  {csvCols.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" className="border px-3 py-2 rounded" onClick={handleDetectColumns}>
              Detect Columns
            </button>
            <button type="button" className="bg-black text-white px-3 py-2 rounded" onClick={handleParseCsv}>
              Parse CSV
            </button>
            <button type="button" className="border px-3 py-2 rounded" onClick={applyCsvToForm} disabled={!csvPreview.items.length}>
              Apply to form
            </button>
          </div>

          {!!csvRows.length && (
            <div className="text-xs">
              <p className="font-medium mt-2">Parsed rows: {csvRows.length}</p>
              <p>
                Preview items: {csvPreview.items.slice(0, 8).join(", ")}
                {csvPreview.items.length > 8 ? " ..." : ""}
              </p>
              <p>
                Preview sizes: {csvPreview.sizes.slice(0, 8).join(", ")}
                {csvPreview.sizes.length > 8 ? " ..." : ""}
              </p>
              <p>
                Preview modifiers: {csvPreview.modifiers.slice(0, 12).join(", ")}
                {csvPreview.modifiers.length > 12 ? " ..." : ""}
              </p>
            </div>
          )}
        </section>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Items</label>
            <textarea
              className="border p-2 w-full h-32"
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Sizes</label>
            <textarea
              className="border p-2 w-full h-32"
              value={sizesText}
              onChange={(e) => setSizesText(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Modifiers</label>
            <textarea
              className="border p-2 w-full h-32"
              value={modsText}
              onChange={(e) => setModsText(e.target.value)}
            />
          </div>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded">Create</button>
      </form>
      {msg && <p className="text-sm">{msg}</p>}
    </main>
  );
}
