"use client";

import { useMemo, useState } from "react";

type Sel = { item?: string; size?: string; mods: string[] };

type CatalogEntry = { key: string; testId: string; label: string; description: string; price: number };

type ModEntry = { key: string; testId: string; label: string; description: string; price: number };

const itemCatalog: CatalogEntry[] = [
  {
    key: "iced matcha latte",
    testId: "sku-iced-matcha",
    label: "Iced Matcha Latte",
    description: "Ceremonial matcha shaken over ice with a hint of vanilla.",
    price: 5.4,
  },
  {
    key: "chai latte",
    testId: "sku-chai-latte",
    label: "Chai Latte",
    description: "House-brewed masala chai with steamed milk and honey.",
    price: 5.1,
  },
  {
    key: "cold brew",
    testId: "sku-cold-brew",
    label: "Cold Brew",
    description: "Slow-steeped beans with citrus aromatics and crisp finish.",
    price: 4.95,
  },
  {
    key: "oat latte",
    testId: "sku-oat-latte",
    label: "Oat Latte",
    description: "Double espresso with velvety oat milk, maple dusting.",
    price: 5.2,
  },
];

const itemLookup = Object.fromEntries(itemCatalog.map((entry) => [entry.key, entry]));

const sizeCatalog: Record<string, { label: string; testId: string; price: number }> = {
  small: { label: "Small · 12oz", testId: "opt-size-s", price: 0 },
  medium: { label: "Medium · 16oz", testId: "opt-size-m", price: 0.6 },
  large: { label: "Large · 20oz", testId: "opt-size-l", price: 1.1 },
};

const modCatalog: ModEntry[] = [
  { key: "oat milk", testId: "opt-milk-oat", label: "Oat Milk", description: "Toasty + creamy", price: 0.6 },
  { key: "almond milk", testId: "opt-milk-almond", label: "Almond Milk", description: "Light and nutty", price: 0.5 },
  { key: "whole milk", testId: "opt-milk-whole", label: "Whole Milk", description: "Classic creaminess", price: 0 },
  { key: "double shot", testId: "opt-shot-double", label: "Double Shot", description: "Extra jolt", price: 1.3 },
  { key: "iced", testId: "opt-iced", label: "Serve Iced", description: "Chilled upgrade", price: 0 },
  {
    key: "brown sugar syrup",
    testId: "opt-syrup-brown-sugar",
    label: "Brown Sugar Syrup",
    description: "Caramelized sweetness",
    price: 0.7,
  },
];

const modLookup = Object.fromEntries(modCatalog.map((entry) => [entry.key, entry]));

export default function MockCafeB() {
  const [sel, setSel] = useState<Sel>({ mods: [] });
  const [summary, setSummary] = useState("Order:\n- (empty)");
  const [status, setStatus] = useState("Welcome to Café B — optimized for iced classics.");

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
    setStatus(`${itemLookup[key].label} selected — now choose size + add-ons.`);
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
      setStatus("Pick a drink to add it to the cart.");
      return;
    }

    const mods = sel.mods.length ? ` (${sel.mods.join(", ")})` : "";
    const line = `- ${capitalize(sel.item)}${sel.size ? " (" + capitalize(sel.size) + ")" : ""}${mods} — $${total.toFixed(2)}`;
    setSummary(`Order:\n${line}`);
    setStatus(`${itemLookup[sel.item].label} locked in. Agent, go complete checkout!`);
  }

  return (
    <main className="min-h-screen bg-emerald-50 p-6 space-y-6">
      <section className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold">ASAPly Demo Café B</h1>
        <p className="text-sm text-emerald-700 mt-1">
          Inspired by breezy afternoons and iced matcha rituals. Built to test automation resilience.
        </p>
        <p className="mt-4 text-sm text-emerald-800">{status}</p>
      </section>

      <section className="bg-white border border-emerald-200 rounded-2xl shadow-sm">
        <header className="px-6 py-4 border-b border-emerald-100">
          <h2 className="text-lg font-semibold">1. Select a beverage</h2>
          <p className="text-xs text-emerald-600">Chilled-forward menu with adaptable aliases.</p>
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
                  isActive ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-100 hover:border-emerald-600"
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

      <section className="bg-white border border-emerald-200 rounded-2xl shadow-sm">
        <header className="px-6 py-4 border-b border-emerald-100">
          <h2 className="text-lg font-semibold">2. Size it</h2>
        </header>
        <div className="flex flex-wrap gap-3 p-6">
          {Object.entries(sizeCatalog).map(([key, size]) => {
            const isActive = sel.size === key;
            return (
              <button
                key={key}
                data-testid={size.testId}
                onClick={() => selectSize(key)}
                className={`border rounded-full px-4 py-2 text-sm transition ${
                  isActive ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-100 hover:border-emerald-600"
                }`}
              >
                {size.label}
                {size.price > 0 ? ` (+$${size.price.toFixed(2)})` : ""}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-emerald-200 rounded-2xl shadow-sm">
        <header className="px-6 py-4 border-b border-emerald-100">
          <h2 className="text-lg font-semibold">3. Flavor boosts</h2>
          <p className="text-xs text-emerald-600">Toggle mix-ins and syrups to match guest preferences.</p>
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
                  isActive ? "border-emerald-600 bg-emerald-700 text-white" : "border-emerald-100 hover:border-emerald-600"
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

      <section className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-6 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Checkout details</h2>
          <span className="text-sm font-medium">Estimated total · ${total.toFixed(2)}</span>
        </header>

        <div className="flex flex-wrap gap-3">
          <button data-testid="btn-add" onClick={addToCart} className="bg-emerald-600 text-white px-4 py-2 rounded">
            Add to cart
          </button>
          <button
            data-testid="btn-cart"
            onClick={() => setStatus("Cart UI is virtual here — handoff to automation expected.")}
            className="border px-4 py-2 rounded"
          >
            View cart
          </button>
          <button
            data-testid="btn-checkout"
            onClick={() => setStatus("Checkout is simulated. Agent should complete the flow.")}
            className="border px-4 py-2 rounded"
          >
            Checkout
          </button>
        </div>

        <form className="grid gap-3 sm:grid-cols-3">
          <input data-testid="input-name" placeholder="Pickup name" className="border border-emerald-100 rounded px-3 py-2" />
          <input data-testid="input-phone" placeholder="SMS updates" className="border border-emerald-100 rounded px-3 py-2" />
          <input data-testid="input-pickup" placeholder="Pickup time" className="border border-emerald-100 rounded px-3 py-2" />
        </form>

        <div className="bg-emerald-700 text-white rounded-xl p-4 text-sm">
          <div className="font-medium">Live preview</div>
          <div className="mt-1 text-emerald-100">
            {activeItem ? (
              <>
                {activeItem.label}
                {activeSize ? ` · ${activeSize.label}` : ""}
                {sel.mods.length > 0 && ` · ${sel.mods.map((mod) => modLookup[mod]?.label ?? mod).join(", ")}`}
              </>
            ) : (
              "Awaiting selections..."
            )}
          </div>
        </div>
      </section>

      <pre data-testid="cart-summary" className="bg-white border border-emerald-200 rounded-2xl p-4 text-sm shadow-sm">
        {summary}
      </pre>
    </main>
  );
}

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
