"use client";

import { useMemo, useState } from "react";

type Sel = { item?: string; size?: string; mods: string[] };

type CatalogEntry = { key: string; testId: string; label: string; description: string; price: number };

type ModEntry = { key: string; testId: string; label: string; description: string; price: number };

const itemCatalog: CatalogEntry[] = [
  {
    key: "matcha latte",
    testId: "item-matcha-latte",
    label: "Matcha Latte",
    description: "Stone-ground Uji matcha, ceremonial whisk, micro-foamed milk.",
    price: 5.25,
  },
  {
    key: "cold brew",
    testId: "item-cold-brew",
    label: "Cold Brew",
    description: "18-hour steeped single-origin beans, poured over slow-melt cubes.",
    price: 4.85,
  },
  {
    key: "oat latte",
    testId: "item-oat-latte",
    label: "Oat Latte",
    description: "Velvety espresso layered with toasted oat milk and orange zest.",
    price: 5.1,
  },
];

const itemLookup = Object.fromEntries(itemCatalog.map((entry) => [entry.key, entry]));

const sizeCatalog: Record<string, { label: string; price: number }> = {
  tall: { label: "Tall · 12oz", price: 0 },
  grande: { label: "Grande · 16oz", price: 0.75 },
  venti: { label: "Venti · 20oz", price: 1.25 },
};

const modCatalog: ModEntry[] = [
  { key: "oat milk", testId: "mod-oat-milk", label: "Oat Milk", description: "Barista edition", price: 0.6 },
  { key: "almond milk", testId: "mod-almond-milk", label: "Almond Milk", description: "Light + nutty", price: 0.5 },
  { key: "whole milk", testId: "mod-whole-milk", label: "Whole Milk", description: "Creamy classic", price: 0 },
  { key: "2x shots", testId: "mod-2x-shots", label: "2x Espresso Shots", description: "Dial up the energy", price: 1.2 },
  { key: "iced", testId: "mod-iced", label: "Serve Iced", description: "Chilled refresh", price: 0 },
  {
    key: "brown sugar syrup",
    testId: "mod-brown-sugar",
    label: "Brown Sugar Syrup",
    description: "Caramel warmth",
    price: 0.7,
  },
];

const modLookup = Object.fromEntries(modCatalog.map((entry) => [entry.key, entry]));

export default function MockCafe() {
  const [sel, setSel] = useState<Sel>({ mods: [] });
  const [summary, setSummary] = useState("Order:\n- (empty)");
  const [status, setStatus] = useState("Tap a signature drink to get started.");

  const activeItem = sel.item ? itemLookup[sel.item] : undefined;
  const activeSize = sel.size ? sizeCatalog[sel.size] : undefined;

  const addOnTotal = useMemo(
    () => sel.mods.reduce((sum, mod) => sum + (modLookup[mod]?.price ?? 0), 0),
    [sel.mods],
  );

  const total = useMemo(() => {
    const base = activeItem?.price ?? 0;
    const sizeUpcharge = activeSize?.price ?? 0;
    return Number((base + sizeUpcharge + addOnTotal).toFixed(2));
  }, [activeItem?.price, activeSize?.price, addOnTotal]);

  function selectItem(key: string) {
    setSel((prev) => ({ ...prev, item: key }));
    setStatus(`Brewing plans for the ${itemLookup[key].label}. Choose a size and extras.`);
  }

  function selectSize(key: string) {
    setSel((prev) => ({ ...prev, size: key }));
  }

  function toggleMod(key: string) {
    setSel((prev) => {
      const has = prev.mods.includes(key);
      return { ...prev, mods: has ? prev.mods.filter((m) => m !== key) : [...prev.mods, key] };
    });
  }

  function addToCart() {
    if (!sel.item) {
      setStatus("Pick a drink before adding to the cart.");
      return;
    }

    const mods = sel.mods.length ? ` (${sel.mods.join(", ")})` : "";
    const line = `- ${capitalize(sel.item)}${sel.size ? " (" + capitalize(sel.size) + ")" : ""}${mods} — $${total.toFixed(2)}`;
    setSummary(`Order:\n${line}`);
    setStatus(`${itemLookup[sel.item].label} logged for pickup. Agent, over to you!`);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold">ASAPly Demo Café A</h1>
        <p className="text-sm text-slate-600 mt-1">
          Human-friendly café UI, ideal for automated ordering drills. Explore our matcha-forward menu.
        </p>
        <p className="mt-4 text-sm text-slate-700">{status}</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <header className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold">1. Choose your drink</h2>
          <p className="text-xs text-slate-500">Seasonal recipes our baristas recommend.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3 p-6">
          {itemCatalog.map((item) => {
            const isActive = sel.item === item.key;
            return (
              <button
                key={item.key}
                data-testid={item.testId}
                onClick={() => selectItem(item.key)}
                className={`text-left border rounded-xl p-4 transition ${
                  isActive ? "border-black bg-black text-white" : "border-slate-200 hover:border-black"
                }`}
              >
                <div className="font-medium">{item.label}</div>
                <div className="text-xs mt-1 opacity-80">{item.description}</div>
                <div className="text-xs mt-3 uppercase tracking-wide">${item.price.toFixed(2)}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <header className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold">2. Pick a size</h2>
        </header>
        <div className="flex flex-wrap gap-3 p-6">
          {Object.entries(sizeCatalog).map(([key, size]) => {
            const isActive = sel.size === key;
            return (
              <button
                key={key}
                data-testid={`size-${key}`}
                onClick={() => selectSize(key)}
                className={`border rounded-full px-4 py-2 text-sm transition ${
                  isActive ? "border-black bg-black text-white" : "border-slate-200 hover:border-black"
                }`}
              >
                {size.label}
                {size.price > 0 ? ` (+$${size.price.toFixed(2)})` : ""}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <header className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold">3. Customize</h2>
          <p className="text-xs text-slate-500">Toggle add-ons to mirror real-world mod flows.</p>
        </header>
        <div className="flex flex-wrap gap-3 p-6">
          {modCatalog.map((mod) => {
            const isActive = sel.mods.includes(mod.key);
            return (
              <button
                key={mod.key}
                data-testid={mod.testId}
                onClick={() => toggleMod(mod.key)}
                className={`border rounded-xl px-4 py-3 text-left text-sm transition ${
                  isActive ? "border-black bg-slate-900 text-white" : "border-slate-200 hover:border-black"
                }`}
              >
                <div className="font-medium">{mod.label}</div>
                <div className="text-xs opacity-80">{mod.description}</div>
                {mod.price > 0 && <div className="text-[11px] mt-2">+${mod.price.toFixed(2)}</div>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Checkout details</h2>
          <span className="text-sm font-medium">Estimated total · ${total.toFixed(2)}</span>
        </header>

        <div className="flex flex-wrap gap-3">
          <button data-testid="add-to-cart" onClick={addToCart} className="bg-black text-white px-4 py-2 rounded">
            Add to cart
          </button>
          <button
            data-testid="view-cart"
            onClick={() => setStatus("Cart preview is simulated – let your agent proceed!")}
            className="border px-4 py-2 rounded"
          >
            View cart
          </button>
          <button
            data-testid="checkout"
            onClick={() => setStatus("Checkout is automated downstream. Ready when you are." )}
            className="border px-4 py-2 rounded"
          >
            Checkout
          </button>
        </div>

        <form className="grid gap-3 sm:grid-cols-3">
          <input data-testid="field-name" placeholder="Pickup name" className="border border-slate-200 rounded px-3 py-2" />
          <input data-testid="field-phone" placeholder="SMS updates" className="border border-slate-200 rounded px-3 py-2" />
          <input data-testid="field-pickup-time" placeholder="Pickup time" className="border border-slate-200 rounded px-3 py-2" />
        </form>

        <div className="bg-slate-900 text-white rounded-xl p-4 text-sm">
          <div className="font-medium">Live preview</div>
          <div className="mt-1 text-slate-200">
            {activeItem ? (
              <>
                {activeItem.label}
                {activeSize ? ` · ${activeSize.label}` : ""}
                {sel.mods.length > 0 && ` · ${sel.mods.map((mod) => modLookup[mod]?.label ?? mod).join(", ")}`}
              </>
            ) : (
              "Waiting for your selection..."
            )}
          </div>
        </div>
      </section>

      <pre data-testid="order-summary" className="bg-white border border-slate-200 rounded-2xl p-4 text-sm shadow-sm">
        {summary}
      </pre>
    </main>
  );
}

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
