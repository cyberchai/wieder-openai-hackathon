"use client";

import { useEffect, useState } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "@/src/lib/firebaseClient";
import type { OrderJSON } from "@/src/types/order";
import styles from "./page.module.css";

type ConfigKey = "a" | "b";

type ExecuteResponse = {
  ok?: boolean;
  exitCode?: number;
  logs?: string;
  error?: string;
};

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [out, setOut] = useState<OrderJSON | null>(null);
  const [busy, setBusy] = useState(false);
  const [configKey, setConfigKey] = useState<ConfigKey>("a");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [execLogs, setExecLogs] = useState<string>("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEmail(null);
        setToken(null);
        setOut(null);
        setFeedback(null);
        setExecLogs("");
        return;
      }
      setEmail(u.email);
      setToken(await u.getIdToken());
    });
  }, []);

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
      setOut(data as OrderJSON);
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

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: out, configKey }),
      });
      const data: ExecuteResponse = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Agent execution failed.");
        return;
      }
      if (typeof data.logs === "string") {
        setExecLogs(data.logs);
      }
      if (data.ok) {
        setFeedback("Agent run complete.");
      } else {
        setFeedback(`Agent exited with code ${data.exitCode ?? "unknown"}.`);
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
          <label htmlFor="merchant" className={styles.selectLabel}>
            Merchant configuration
          </label>
          <select
            id="merchant"
            className={styles.select}
            value={configKey}
            onChange={(event) => setConfigKey(event.target.value as ConfigKey)}
          >
            <option value="a">ASAPly Demo Café A (Tall/Grande/Venti)</option>
            <option value="b">ASAPly Demo Café B (Small/Medium/Large)</option>
          </select>
        </div>

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
          </div>
        )}

        <p className={styles.footerNote}>
          Demo only. Replace env values with your Firebase project and OpenAI key before going live.
        </p>
      </section>
    </main>
  );
}
