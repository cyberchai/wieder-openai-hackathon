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

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [out, setOut] = useState<OrderJSON | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEmail(null);
        setToken(null);
        setOut(null);
        setFeedback(null);
        return;
      }
      setEmail(u.email);
      setToken(await u.getIdToken());
    });
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
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
      setFeedback("Plan generated successfully.");
    } catch (error) {
      setFeedback("Unable to reach the planner. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.container}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h1 className={styles.title}>ASAP<i>ly</i></h1>
          <p className={styles.subtitle}>
            Authenticate with Google, describe a café order, and let GPT-5 craft a
            structured fulfillment plan in seconds.
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

        <form onSubmit={submit} className={styles.form}>
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
            {busy ? "Thinking..." : "Order"}
          </button>
        </form>

        <div className={`${styles.feedback} ${out ? styles.success : ""}`}>
          {feedback}
        </div>

        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span>Planner response</span>
            {out?._requestedBy && <span className={styles.previewMeta}>requested by {out._requestedBy}</span>}
          </div>
          <pre className={`${styles.pre} ${!out ? styles.placeholder : ""}`}>
            {out
              ? JSON.stringify(out, null, 2)
              : "JSON output will appear here after you submit."}
          </pre>
        </div>

        <p className={styles.footerNote}>
          Demo only. Replace env values with your Firebase project and OpenAI key before going live.
        </p>
      </section>
    </main>
  );
}
