"use client";

import { useState } from "react";
import type { MerchantConfig } from "@/src/types/merchant";
import { auth } from "@/src/lib/firebaseClient";

export default function NewMerchant() {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000/mock-cafe");
  const [itemsText, setItemsText] = useState("Matcha Latte\nCold Brew\nOat Latte");
  const [sizesText, setSizesText] = useState("Tall\nGrande\nVenti");
  const [modsText, setModsText] = useState("Oat Milk\nAlmond Milk\nWhole Milk\n2x Shots");
  const [msg, setMsg] = useState("");

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

    window.location.href = `/merchant/${saved.id}`;
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
