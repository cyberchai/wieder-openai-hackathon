"use client";
import { useState } from "react";

type Sel = { item?: string; size?: string; mods: string[] };

export default function MockCafeB() {
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
      <h1>ASAPly Demo Café B</h1>

      {/* Items */}
      <div className="space-x-2">
        <button data-testid="sku-iced-matcha" onClick={() => setItem("iced matcha latte")}>
          Iced Matcha Latte
        </button>
        <button data-testid="sku-cold-brew" onClick={() => setItem("cold brew")}>Cold Brew</button>
        <button data-testid="sku-oat-latte" onClick={() => setItem("oat latte")}>Oat Latte</button>
      </div>

      {/* Sizes */}
      <div className="space-x-2">
        <button data-testid="opt-size-s" onClick={() => setSize("small")}>Small</button>
        <button data-testid="opt-size-m" onClick={() => setSize("medium")}>Medium</button>
        <button data-testid="opt-size-l" onClick={() => setSize("large")}>Large</button>
      </div>

      {/* Modifiers */}
      <div className="space-x-2">
        <button data-testid="opt-milk-oat" onClick={() => toggleMod("oat milk")}>Oat Milk</button>
        <button data-testid="opt-milk-almond" onClick={() => toggleMod("almond milk")}>Almond Milk</button>
        <button data-testid="opt-milk-whole" onClick={() => toggleMod("whole milk")}>Whole Milk</button>
        <button data-testid="opt-shot-double" onClick={() => toggleMod("double shot")}>Double Shot</button>
      </div>

      {/* Actions */}
      <div className="space-x-2">
        <button data-testid="btn-add" onClick={addToCart}>Add to cart</button>
        <button data-testid="btn-cart" onClick={() => {}}>
          View cart
        </button>
        <button data-testid="btn-checkout" onClick={() => {}}>
          Checkout
        </button>
      </div>

      {/* Checkout fields */}
      <form className="space-y-2">
        <input data-testid="input-name" placeholder="Name" className="border p-1" />
        <input data-testid="input-phone" placeholder="Phone" className="border p-1" />
        <input data-testid="input-pickup" placeholder="Pickup time" className="border p-1" />
      </form>

      {/* Summary */}
      <pre data-testid="cart-summary" className="bg-gray-100 p-3 rounded text-sm">
        {summary}
      </pre>
    </main>
  );
}
