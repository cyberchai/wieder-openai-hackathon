"use client";

import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import type { MerchantConfig } from "@/src/types/merchant";
import { auth, googleProvider, onAuthStateChanged, signInWithPopup, signOut } from "@/src/lib/firebaseClient";

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
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      if (current) {
        setUser({ uid: current.uid, email: current.email });
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [menuOpen]);

  const menuItems = user
    ? [
        {
          label: "Back to planner",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/";
          },
        },
        {
          label: "Manage merchants",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/merchant/manage";
          },
        },
        {
          label: "View orders",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/orders";
          },
        },
        {
          label: "Sign out",
          action: async () => {
            await signOut(auth);
            setMenuOpen(false);
          },
        },
      ]
    : [
        {
          label: "Sign in with Google",
          action: async () => {
            await signInWithPopup(auth, googleProvider);
            setMenuOpen(false);
          },
        },
      ];

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
    <main className="app-shell">
      <section className="card">
        <div className="card-header-row">
          <div className="card-header">
            <span className="app-logo" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 21v-2h16v2H4Zm4-4q-1.65 0-2.825-1.175T4 13V3h16q.825 0 1.413.588T22 5v3q0 .825-.588 1.413T20 10h-2v3q0 1.65-1.175 2.825T14 17H8Zm10-9h2V5h-2v3ZM8 15h6q.825 0 1.413-.588T16 13V5h-6v.4l1.8 1.45q.05.05.2.4v4.25q0 .2-.15.35t-.35.15h-4q-.2 0-.35-.15T7 11.5V7.25q0-.05.2-.4L9 5.4V5H6v8q0 .825.588 1.413T8 15Zm3-5ZM9 5h1h-1Z" />
              </svg>
            </span>
            <header className="app-header">New Merchant</header>
          </div>

          <div className="card-header-chip" ref={menuRef}>
            <button type="button" className="chip" onClick={() => setMenuOpen((open) => !open)}>
              {user?.email || "Sign in"}
            </button>
            {menuOpen && (
              <div className="chip-menu">
                {menuItems.map((item) => (
                  <button key={item.label} type="button" onClick={item.action}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "0 32px 40px" }}>
          <form onSubmit={submit}>
            {/* Basic Info Section */}
            <div style={{ marginBottom: "40px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                <div>
                  <label htmlFor="merchant-name" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                    Merchant Name
                  </label>
                  <input
                    id="merchant-name"
                    name="merchant-name"
                    type="text"
                    placeholder="Enter merchant name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "16px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "2px solid #000",
                      borderRadius: "999px",
                      outline: "none",
                      backgroundColor: "#fff"
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="base-url" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                    Base URL
                  </label>
                  <input
                    id="base-url"
                    name="base-url"
                    type="text"
                    placeholder="http://localhost:3000/mock-cafe"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "16px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "2px solid #000",
                      borderRadius: "999px",
                      outline: "none",
                      backgroundColor: "#fff"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* CSV Import Section */}
            <div style={{ 
              marginBottom: "40px", 
              padding: "32px", 
              border: "2px solid #000", 
              borderRadius: "24px", 
              backgroundColor: "#f8fafc" 
            }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                Import from CSV / Google Sheets
              </h2>
              <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "32px", lineHeight: "1.6" }}>
                CSV columns supported: <code style={{ backgroundColor: "#e5e7eb", padding: "4px 8px", borderRadius: "4px", fontSize: "14px" }}>name</code> (required), 
                <code style={{ backgroundColor: "#e5e7eb", padding: "4px 8px", borderRadius: "4px", fontSize: "14px" }}>size</code> (optional), 
                <code style={{ backgroundColor: "#e5e7eb", padding: "4px 8px", borderRadius: "4px", fontSize: "14px" }}>modifier</code> (optional).
                <br />
                Sizes/modifiers can be separated by comma, semicolon, or pipe. Google Sheets: Publish to the web → CSV.
              </p>
              
              {/* Tab Slider */}
              <div style={{ marginBottom: "32px" }}>
                <div style={{ 
                  display: "flex", 
                  backgroundColor: "#e5e7eb", 
                  borderRadius: "12px", 
                  padding: "4px",
                  marginBottom: "24px",
                  width: "fit-content",
                  position: "relative"
                }}>
                  {/* Active tab highlight */}
                  <div style={{
                    position: "absolute",
                    top: "4px",
                    left: activeTab === 'file' ? "4px" : "50%",
                    width: "50%",
                    height: "calc(100% - 8px)",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    transition: "left 0.2s ease",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }} />
                  
                  <button
                    type="button"
                    onClick={() => setActiveTab('file')}
                    style={{
                      padding: "12px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      color: "#374151",
                      transition: "color 0.2s ease",
                      position: "relative",
                      zIndex: 1
                    }}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('url')}
                    style={{
                      padding: "12px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      color: "#374151",
                      transition: "color 0.2s ease",
                      position: "relative",
                      zIndex: 1
                    }}
                  >
                    CSV URL
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'file' && (
                  <div>
                    <label htmlFor="csv-file" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                      Upload CSV file
                    </label>
                    <div style={{ position: "relative", width: "100%" }}>
                      <input 
                        id="csv-file"
                        name="csv-file"
                        type="file" 
                        accept=".csv,text/csv" 
                        onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                        style={{
                          position: "absolute",
                          width: "100%",
                          height: "100%",
                          opacity: 0,
                          cursor: "pointer",
                          zIndex: 2
                        }}
                      />
                      <div style={{
                        width: "100%",
                        padding: "16px 24px",
                        fontSize: "16px",
                        fontWeight: "600",
                        border: "2px solid #000",
                        borderRadius: "999px",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        minHeight: "56px"
                      }}>
                        <span style={{ color: csvFile ? "#000" : "#9ca3af" }}>
                          {csvFile ? csvFile.name : "Choose CSV file..."}
                        </span>
                        <span style={{ 
                          fontSize: "14px", 
                          color: "#6b7280",
                          fontWeight: "500"
                        }}>
                          Browse
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'url' && (
                  <div>
                    <label htmlFor="csv-url" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                      CSV URL (Google Sheets "Publish to web" CSV)
                    </label>
                    <input
                      id="csv-url"
                      name="csv-url"
                      type="text"
                      placeholder="https://docs.google.com/.../export?format=csv"
                      value={csvUrl || ""}
                      onChange={(event) => setCsvUrl(event.target.value)}
                      style={{
                        width: "100%",
                        padding: "16px 24px",
                        fontSize: "16px",
                        fontWeight: "600",
                        border: "2px solid #000",
                        borderRadius: "999px",
                        outline: "none",
                        backgroundColor: "#fff"
                      }}
                    />
                  </div>
                )}
              </div>

              {csvCols.length > 0 && (
                <div style={{ marginBottom: "32px" }}>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px", color: "#111827" }}>Column Mapping</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
                    <div>
                      <label htmlFor="col-name" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                        Item name column
                      </label>
                      <select
                        id="col-name"
                        name="col-name"
                        value={colMap.name || ""}
                        onChange={(event) => setColMap({ ...colMap, name: event.target.value || undefined })}
                        style={{
                          width: "100%",
                          padding: "16px",
                          fontSize: "16px",
                          border: "2px solid #000",
                          borderRadius: "12px",
                          outline: "none",
                          backgroundColor: "#fff"
                        }}
                      >
                        <option value="">-- Select --</option>
                        {csvCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="col-size" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                        Size column (optional)
                      </label>
                      <select
                        id="col-size"
                        name="col-size"
                        value={colMap.size || ""}
                        onChange={(event) => setColMap({ ...colMap, size: event.target.value || undefined })}
                        style={{
                          width: "100%",
                          padding: "16px",
                          fontSize: "16px",
                          border: "2px solid #000",
                          borderRadius: "12px",
                          outline: "none",
                          backgroundColor: "#fff"
                        }}
                      >
                        <option value="">-- None --</option>
                        {csvCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="col-modifier" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                        Modifier column (optional)
                      </label>
                      <select
                        id="col-modifier"
                        name="col-modifier"
                        value={colMap.modifier || ""}
                        onChange={(event) => setColMap({ ...colMap, modifier: event.target.value || undefined })}
                        style={{
                          width: "100%",
                          padding: "16px",
                          fontSize: "16px",
                          border: "2px solid #000",
                          borderRadius: "12px",
                          outline: "none",
                          backgroundColor: "#fff"
                        }}
                      >
                        <option value="">-- None --</option>
                        {csvCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginBottom: "24px" }}>
                <button 
                  type="button" 
                  onClick={handleDetectColumns}
                  style={{
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "2px solid #000",
                    borderRadius: "999px",
                    backgroundColor: "#fff",
                    color: "#000",
                    cursor: "pointer"
                  }}
                >
                  Detect Columns
                </button>
                <button 
                  type="button" 
                  onClick={handleParseCsv}
                  style={{
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "2px solid #000",
                    borderRadius: "999px",
                    backgroundColor: "#000",
                    color: "#fff",
                    cursor: "pointer"
                  }}
                >
                  Parse CSV
                </button>
                <button 
                  type="button" 
                  onClick={applyCsvToForm} 
                  disabled={!csvPreview.items.length}
                  style={{
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "2px solid #000",
                    borderRadius: "999px",
                    backgroundColor: "#fff",
                    color: "#000",
                    cursor: csvPreview.items.length ? "pointer" : "not-allowed",
                    opacity: csvPreview.items.length ? 1 : 0.5
                  }}
                >
                  Apply to form
                </button>
              </div>

              {!!csvRows.length && (
                <div style={{ 
                  backgroundColor: "#fff", 
                  padding: "24px", 
                  borderRadius: "16px", 
                  border: "2px solid #e5e7eb" 
                }}>
                  <h4 style={{ fontWeight: "600", marginBottom: "16px", color: "#111827" }}>CSV Preview</h4>
                  <div style={{ fontSize: "14px" }}>
                    <p style={{ marginBottom: "8px" }}><strong>Parsed rows:</strong> {csvRows.length}</p>
                    <p style={{ marginBottom: "8px" }}><strong>Preview items:</strong> <span style={{ color: "#6b7280" }}>{csvPreview.items.slice(0, 8).join(", ")}{csvPreview.items.length > 8 ? " ..." : ""}</span></p>
                    <p style={{ marginBottom: "8px" }}><strong>Preview sizes:</strong> <span style={{ color: "#6b7280" }}>{csvPreview.sizes.slice(0, 8).join(", ")}{csvPreview.sizes.length > 8 ? " ..." : ""}</span></p>
                    <p><strong>Preview modifiers:</strong> <span style={{ color: "#6b7280" }}>{csvPreview.modifiers.slice(0, 12).join(", ")}{csvPreview.modifiers.length > 12 ? " ..." : ""}</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* Menu Configuration Section */}
            <div style={{ 
              marginBottom: "40px", 
              padding: "32px", 
              border: "2px solid #000", 
              borderRadius: "24px", 
              backgroundColor: "#f8fafc" 
            }}>
              <h3 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "32px", color: "#111827" }}>
                Menu Configuration
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                <div>
                  <label htmlFor="items-text" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                    Items
                  </label>
                  <textarea
                    id="items-text"
                    name="items-text"
                    value={itemsText}
                    onChange={(e) => {
                      setItemsText(e.target.value);
                      e.target.style.height = 'auto';
                      const newHeight = Math.min(e.target.scrollHeight, 400);
                      e.target.style.height = newHeight + 'px';
                      // Decrease border radius when content expands beyond original height
                      if (newHeight > 140) {
                        e.target.style.borderRadius = "16px";
                      } else {
                        e.target.style.borderRadius = "999px";
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "16px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "2px solid #000",
                      borderRadius: "999px",
                      outline: "none",
                      backgroundColor: "#fff",
                      resize: "none",
                      minHeight: "140px",
                      maxHeight: "400px"
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="sizes-text" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                    Sizes
                  </label>
                  <textarea
                    id="sizes-text"
                    name="sizes-text"
                    value={sizesText}
                    onChange={(e) => {
                      setSizesText(e.target.value);
                      e.target.style.height = 'auto';
                      const newHeight = Math.min(e.target.scrollHeight, 400);
                      e.target.style.height = newHeight + 'px';
                      // Decrease border radius when content expands beyond original height
                      if (newHeight > 140) {
                        e.target.style.borderRadius = "16px";
                      } else {
                        e.target.style.borderRadius = "999px";
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "16px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "2px solid #000",
                      borderRadius: "999px",
                      outline: "none",
                      backgroundColor: "#fff",
                      resize: "none",
                      minHeight: "140px",
                      maxHeight: "400px"
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="modifiers-text" style={{ display: "block", marginBottom: "12px", fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                    Modifiers
                  </label>
                  <textarea
                    id="modifiers-text"
                    name="modifiers-text"
                    value={modsText}
                    onChange={(e) => {
                      setModsText(e.target.value);
                      e.target.style.height = 'auto';
                      const newHeight = Math.min(e.target.scrollHeight, 400);
                      e.target.style.height = newHeight + 'px';
                      // Decrease border radius when content expands beyond original height
                      if (newHeight > 140) {
                        e.target.style.borderRadius = "16px";
                      } else {
                        e.target.style.borderRadius = "999px";
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "16px 24px",
                      fontSize: "16px",
                      fontWeight: "600",
                      border: "2px solid #000",
                      borderRadius: "999px",
                      outline: "none",
                      backgroundColor: "#fff",
                      resize: "none",
                      minHeight: "140px",
                      maxHeight: "400px"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <button 
                type="submit"
                style={{
                  padding: "16px 48px",
                  fontSize: "18px",
                  fontWeight: "600",
                  border: "2px solid #000",
                  borderRadius: "999px",
                  backgroundColor: "#000",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Create Merchant
              </button>
            </div>

            {/* Message */}
            {msg && (
              <div style={{ textAlign: "center" }}>
                <div style={{ 
                  backgroundColor: "#f9fafb", 
                  padding: "16px", 
                  borderRadius: "16px", 
                  border: "2px solid #e5e7eb", 
                  maxWidth: "400px", 
                  margin: "0 auto" 
                }}>
                  <p style={{ fontSize: "14px", color: "#6b7280" }}>{msg}</p>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
