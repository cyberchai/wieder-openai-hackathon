"use client";
import { useState } from "react";

type Sel = { item?: string; size?: string; mods: string[] };

export default function MockCafe() {
  const [sel, setSel] = useState<Sel>({ mods: [] });
  const [summary, setSummary] = useState<string>("Order:\n- (empty)");

  function setItem(v: string) {
    setSel((s) => ({ ...s, item: v }));
  }

  function setSize(v: string) {
    setSel((s) => ({ ...s, size: v }));
  }

  function toggleMod(v: string) {
    setSel((s) => {
      const has = s.mods.includes(v);
      return { ...s, mods: has ? s.mods.filter((m) => m !== v) : [...s.mods, v] };
    });
  }

  function addToCart() {
    const mods = sel.mods.length ? ` (${sel.mods.join(", ")})` : "";
    const line = sel.item
      ? `- ${capitalize(sel.item)}${sel.size ? " (" + capitalize(sel.size) + ")" : ""}${mods}`
      : "- (no item)";
    setSummary(`Order:\n${line}`);
  }

  function capitalize(value?: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  return (
    <main className="p-6 space-y-4">
      <h1>ASAPly Demo Café A</h1>

      {/* Items */}
      <div className="space-x-2">
        <button data-testid="item-matcha-latte" onClick={() => setItem("matcha latte")}>
          Matcha Latte
        </button>
        <button data-testid="item-cold-brew" onClick={() => setItem("cold brew")}>Cold Brew</button>
        <button data-testid="item-oat-latte" onClick={() => setItem("oat latte")}>Oat Latte</button>
      </div>

      {/* Sizes Tall/Grande/Venti */}
      <div className="space-x-2">
        <button data-testid="size-tall" onClick={() => setSize("tall")}>Tall</button>
        <button data-testid="size-grande" onClick={() => setSize("grande")}>Grande</button>
        <button data-testid="size-venti" onClick={() => setSize("venti")}>Venti</button>
      </div>

      {/* Modifiers */}
      <div className="space-x-2">
        <button data-testid="mod-oat-milk" onClick={() => toggleMod("oat milk")}>Oat Milk</button>
        <button data-testid="mod-almond-milk" onClick={() => toggleMod("almond milk")}>Almond Milk</button>
        <button data-testid="mod-whole-milk" onClick={() => toggleMod("whole milk")}>Whole Milk</button>
        <button data-testid="mod-2x-shots" onClick={() => toggleMod("2x shots")}>2x Shots</button>
      </div>

      {/* Actions */}
      <div className="space-x-2">
        <button data-testid="add-to-cart" onClick={addToCart}>Add to cart</button>
        <button data-testid="view-cart" onClick={() => {}}>
          View cart
        </button>
        <button data-testid="checkout" onClick={() => {}}>
          Checkout
        </button>
      </div>

      {/* Checkout fields */}
      <form className="space-y-2">
        <input data-testid="field-name" placeholder="Name" className="border p-1" />
        <input data-testid="field-phone" placeholder="Phone" className="border p-1" />
        <input data-testid="field-pickup-time" placeholder="Pickup time" className="border p-1" />
      </form>

      {/* Summary */}
      <pre data-testid="order-summary" className="bg-gray-100 p-3 rounded text-sm">
        {summary}
      </pre>
    </main>
  );
}
