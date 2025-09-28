"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MerchantConfig } from "@/src/types/merchant";
import { auth } from "@/src/lib/firebaseClient";

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function EditMerchantClient({ id }: { id: string }) {
  const [cfg, setCfg] = useState<MerchantConfig | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/merchants/${id}`)
      .then((res) => res.json())
      .then((data) => setCfg(data))
      .catch(() => setCfg(null));
  }, [id]);

  if (!cfg) {
    return <main className="p-6">Loading…</main>;
  }

  async function save() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      alert("Sign in first");
      return;
    }
    const val = await fetch("/api/merchants/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }).then((res) => res.json());
    if (!val.ok) {
      setMsg("Preflight ✕ Missing: " + (val.missing || []).join(", "));
      return;
    }
    await fetch(`/api/merchants/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cfg),
    });
    setMsg("Saved ✓");
  }

  async function remove() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      alert("Sign in first");
      return;
    }
    await fetch(`/api/merchants/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    window.location.href = "/merchant";
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit: {cfg.name}</h1>
        <div className="flex gap-2">
          <Link className="underline" href="/merchant">
            Back
          </Link>
          <button
            onClick={() => {
              localStorage.setItem("asaply.selectedMerchantId", id);
              setMsg("Set as active merchant for demo.");
            }}
            className="border px-3 py-2 rounded"
          >
            Use in demo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm">Name</label>
          <input
            className="border p-2 w-full"
            value={cfg.name}
            onChange={(e) => setCfg({ ...cfg, name: e.target.value })}
          />
          <label className="block text-sm">Base URL</label>
          <input
            className="border p-2 w-full"
            value={cfg.baseUrl}
            onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
          />
          <label className="block text-sm">Verification summary selector</label>
          <input
            className="border p-2 w-full"
            value={cfg.verification?.summarySelector || ""}
            onChange={(e) =>
              setCfg({ ...cfg, verification: { ...cfg.verification, summarySelector: e.target.value } })
            }
          />
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="bg-black text-white px-4 py-2 rounded">
              Save
            </button>
            <button onClick={remove} className="border px-4 py-2 rounded">
              Delete
            </button>
          </div>
          {msg && <p className="text-sm whitespace-pre-line">{msg}</p>}
        </div>

        <div className="space-y-2">
          <label className="block text-sm">Selectors</label>
          <textarea
            className="border p-2 w-full h-64 font-mono text-xs"
            value={JSON.stringify(cfg.selectors, null, 2)}
            onChange={(e) => setCfg({ ...cfg, selectors: safeParse(e.target.value || "{}", {}) })}
          />
          <label className="block text-sm">Menu (items)</label>
          <textarea
            className="border p-2 w-full h-56 font-mono text-xs"
            value={JSON.stringify(cfg.menu || { items: [] }, null, 2)}
            onChange={(e) => setCfg({ ...cfg, menu: safeParse(e.target.value || "{}", { items: [] }) })}
          />
        </div>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer">Advanced (normalize / availability / checkout)</summary>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <textarea
            className="border p-2 w-full h-48 font-mono text-xs"
            defaultValue={JSON.stringify(cfg.normalize || {}, null, 2)}
            onBlur={(e) => setCfg({ ...cfg, normalize: safeParse(e.target.value || "{}", {}) })}
          />
          <textarea
            className="border p-2 w-full h-48 font-mono text-xs"
            defaultValue={JSON.stringify(cfg.availability || {}, null, 2)}
            onBlur={(e) => setCfg({ ...cfg, availability: safeParse(e.target.value || "{}", {}) })}
          />
          <textarea
            className="border p-2 w-full h-48 font-mono text-xs"
            defaultValue={JSON.stringify(cfg.checkout || {}, null, 2)}
            onBlur={(e) => setCfg({ ...cfg, checkout: safeParse(e.target.value || "{}", {}) })}
          />
        </div>
      </details>

      <div className="pt-2 flex gap-3">
        <button
          onClick={async () => {
            const res = await fetch("/api/merchants/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cfg),
            }).then((r) => r.json());
            setMsg(res.ok ? "Preflight ✓ Ready" : "Preflight ✕ Missing: " + res.missing.join(", "));
          }}
          className="border px-3 py-2 rounded"
        >
          Run Preflight
        </button>
        <Link className="underline px-2 py-2" href="/">
          Go to demo
        </Link>
      </div>
    </main>
  );
}
