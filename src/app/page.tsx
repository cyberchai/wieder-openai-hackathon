"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "@/src/lib/firebaseClient";
import type { OrderJSON } from "@/src/types/order";
import styles from "./page.module.css";

type ExecuteResponse = {
  ok?: boolean;
  exitCode?: number;
  logs?: string;
  error?: string;
};

type ConfigKey = "a" | "b";

const LEGACY_MERCHANTS = [
  { id: "legacy:a", name: "ASAPly Demo Café A (Tall/Grande/Venti)" },
  { id: "legacy:b", name: "ASAPly Demo Café B (Small/Medium/Large)" },
];

const STORAGE_KEY = "asaply.selectedMerchant";

function normalizeSelection(saved: string | null, cloud: { id: string }[]): string {
  if (!saved) return LEGACY_MERCHANTS[0]?.id ?? "legacy:a";
  if (saved.startsWith("legacy:") || saved.startsWith("firestore:")) return saved;
  if (saved === "a" || saved === "b") return `legacy:${saved}`;
  if (cloud.some((merchant) => merchant.id === saved)) return `firestore:${saved}`;
  return LEGACY_MERCHANTS[0]?.id ?? "legacy:a";
}

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [out, setOut] = useState<OrderJSON | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloudMerchants, setCloudMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>(LEGACY_MERCHANTS[0].id);
  const mergedMerchants = useMemo(
    () => [
      ...LEGACY_MERCHANTS,
      ...cloudMerchants.map((merchant) => ({ id: `firestore:${merchant.id}`, name: merchant.name })),
    ],
    [cloudMerchants],
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [execLogs, setExecLogs] = useState<string>("");
  const [execNotice, setExecNotice] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEmail(null);
        setToken(null);
        setOut(null);
        setFeedback(null);
        setExecLogs("");
        setExecNotice(null);
        return;
      }
      setEmail(u.email);
      setToken(await u.getIdToken());
    });
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/merchants", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.merchants) ? data.merchants : [];
        setCloudMerchants(list);
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("asaply.selectedMerchantId");
          const normalized = normalizeSelection(stored, list);
          setSelectedMerchant(normalized);
          localStorage.setItem(STORAGE_KEY, normalized);
          localStorage.removeItem("asaply.selectedMerchantId");
        }
      })
      .catch(() => {
        if (!active) return;
        setCloudMerchants([]);
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("asaply.selectedMerchantId");
          if (stored) {
            const normalized = normalizeSelection(stored, []);
            setSelectedMerchant(normalized);
            localStorage.setItem(STORAGE_KEY, normalized);
            localStorage.removeItem("asaply.selectedMerchantId");
          }
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mergedMerchants.length) return;
    if (!mergedMerchants.some((merchant) => merchant.id === selectedMerchant)) {
      setSelectedMerchant(mergedMerchants[0].id);
    }
  }, [mergedMerchants, selectedMerchant]);

  async function plan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setFeedback("Please sign in to send a request.");
      return;
    }
    if (!q.trim()) {
      setFeedback("Add a quick order description before submitting.");
      return;
    }

    setBusy(true);
    setFeedback(null);
    setOut(null);
    setExecLogs("");
    setExecNotice(null);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(typeof data.error === "string" ? data.error : "Request failed.");
        return;
      }
      const planData = data as OrderJSON;
      setOut(planData);
      setFeedback("Plan generated successfully. Review the JSON below.");
    } catch {
      setFeedback("Unable to reach the planner. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runAgent() {
    if (!token) {
      setFeedback("Please sign in to run the agent.");
      return;
    }
    if (!out) {
      setFeedback("Create a plan before running the agent.");
      return;
    }

    setExecuting(true);
    setFeedback("Running agent with selected merchant...");
    setExecLogs("");
    setExecNotice(null);

    try {
      const selection = selectedMerchant;
      const payload: Record<string, unknown> = { plan: out };
      let merchantIdentifier = selection;
      if (selection.startsWith("firestore:")) {
        const firestoreId = selection.slice("firestore:".length);
        payload.merchantId = firestoreId;
        merchantIdentifier = firestoreId;
      } else {
        const legacyKey = (selection.replace("legacy:", "") || "a") as ConfigKey;
        payload.configKey = legacyKey;
        merchantIdentifier = legacyKey;
      }

      const res = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data: ExecuteResponse = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Agent execution failed.");
        return;
      }
      const logs = typeof data.logs === "string" ? data.logs : "";
      setExecLogs(logs);
      const pass = /\[verify\]\s+RESULT:\s+PASS/.test(logs);
      if (pass) {
        setFeedback("Agent run complete.");
        setExecNotice("Order verified and saved to history.");
        fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan: out, merchant: merchantIdentifier, status: "PASS" }),
        }).catch(() => {
          /* ignore logging errors */
        });
      } else {
        const suggestMatches = logs.match(/^\[suggest\].*$/gm) || [];
        const msg = suggestMatches.length
          ? `Not on this menu. Suggestions:\n${suggestMatches.join("\n")}`
          : "This item isn't on this menu. Try another item or a different store.";
        setFeedback("Could not verify the order. Check the suggestions below.");
        setExecNotice(msg);
        console.warn(msg);
      }
    } catch {
      setFeedback("Unable to run the agent. Check the server logs.");
    } finally {
      setExecuting(false);
    }
  }

  const isSuccess = feedback ? /successfully|complete/i.test(feedback) : false;

  return (
    <main className={styles.container}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h1 className={styles.title}>GPT Checkout</h1>
          <p className={styles.subtitle}>
            Authenticate with Google, choose a café config, describe an order, and let GPT-5 craft a
            structured fulfillment plan.
          </p>
        </header>

        <div className={styles.authRow}>
          {email ? (
            <>
              <div className={styles.userChip}>
                <span className={styles.userAvatar}>{email[0]?.toUpperCase()}</span>
                <span>{email}</span>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => signOut(auth)}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => signInWithPopup(auth, googleProvider)}
            >
              Sign in with Google
            </button>
          )}
        </div>

        <div className={styles.selectGroup}>
          <label htmlFor="merchantSelect" className={styles.selectLabel}>
            Merchant configuration
          </label>
          <select
            id="merchantSelect"
            className={styles.select}
            value={selectedMerchant}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedMerchant(value);
              if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEY, value);
              }
            }}
          >
            {mergedMerchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
          <Link className="underline text-sm" href="/merchant">
            Manage merchants
          </Link>
        </div>

        <Link href="/orders" className={styles.secondaryButton}>
          View orders
        </Link>

        <form onSubmit={plan} className={styles.form}>
          <div className={styles.labelRow}>
            <label htmlFor="orderInput">Order prompt</label>
            <span className={styles.hint}>
              Example: Large oat latte + chocolate croissant at 12:30 pickup
            </span>
          </div>
          <input
            id="orderInput"
            className={styles.input}
            placeholder="Describe the drinks, food, and timing for pickup"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="submit"
            className={`${styles.primaryButton} ${styles.submitButton}`}
            disabled={busy || !token}
          >
            {busy ? "Thinking..." : "Plan order"}
          </button>
        </form>

        <div className={`${styles.feedback} ${isSuccess ? styles.success : ""}`}>
          {feedback}
        </div>

        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span>Planner response</span>
            {out?._requestedBy && (
              <span className={styles.previewMeta}>requested by {out._requestedBy}</span>
            )}
          </div>
          <pre className={`${styles.pre} ${!out ? styles.placeholder : ""}`}>
            {out
              ? JSON.stringify(out, null, 2)
              : "JSON output will appear here after you submit."}
          </pre>
        </div>

        {out && (
          <div className={styles.runSection}>
            <button
              type="button"
              className={`${styles.primaryButton} ${styles.runButton}`}
              disabled={executing}
              onClick={runAgent}
            >
              {executing ? "Running agent..." : "Run agent"}
            </button>
            {(execLogs || executing) && (
              <pre className={styles.logs}>
                {execLogs || "Streaming logs..."}
              </pre>
            )}
            {execNotice && (
              <div className={styles.feedback}>{execNotice}</div>
            )}
          </div>
        )}

        <p className={styles.footerNote}>
          Demo only. Replace env values with your Firebase project and OpenAI key before going live.
        </p>
      </section>
    </main>
  );
}
