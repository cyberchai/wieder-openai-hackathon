"use client";

import { useState } from "react";
import { auth } from "@/src/lib/firebaseClient";
import type { MerchantConfig } from "@/src/types/merchant";

type AutogenResult = {
  ok: boolean;
  draft?: MerchantConfig;
  missingSelectors?: string[];
  capturedCount?: number;
  reason?: string;
};

export default function MerchantAutogen() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000/mock-cafe");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutogenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAutogen(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/autogen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl }),
      });
      const data: AutogenResult = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.reason || "Autogen failed");
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Autogen failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!result?.draft) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      alert("Sign in first");
      return;
    }
    const saved = await fetch("/api/merchants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(result.draft as Partial<MerchantConfig>),
    }).then((res) => res.json());
    if (saved?.id) {
      window.location.href = `/merchant/${saved.id}`;
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Merchant Autogen</h1>
      <form onSubmit={runAutogen} className="space-y-3">
        <input
          className="border p-2 w-full"
          placeholder="https://your-store.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <button className="bg-black text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? "Generating…" : "Auto-generate"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result?.draft && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Draft MerchantConfig</h2>
            <pre className="bg-gray-100 p-3 text-xs overflow-auto max-h-96">
              {JSON.stringify(result.draft, null, 2)}
            </pre>
            <p className="text-xs text-gray-600 mt-1">Captured JSON responses: {result.capturedCount ?? 0}</p>
          </div>
          {result.missingSelectors?.length ? (
            <div>
              <h3 className="font-semibold text-sm">Missing selectors</h3>
              <ul className="list-disc pl-5 text-sm">
                {result.missingSelectors.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">Selectors look complete.</p>
          )}
          <div className="flex gap-3">
            <button onClick={saveDraft} className="bg-black text-white px-4 py-2 rounded">
              Save as merchant
            </button>
            <button onClick={() => setResult(null)} className="border px-4 py-2 rounded">
              Clear
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
