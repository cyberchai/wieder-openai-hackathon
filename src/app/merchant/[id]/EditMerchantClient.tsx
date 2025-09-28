"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import type { MerchantConfig } from "@/src/types/merchant";
import { auth, googleProvider, onAuthStateChanged, signInWithPopup, signOut } from "@/src/lib/firebaseClient";

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function EditMerchantClient({ id }: { id: string }) {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [cfg, setCfg] = useState<MerchantConfig | null>(null);
  const [msg, setMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      if (current) {
        setUser({ uid: current.uid, email: current.email });
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetch(`/api/merchants/${id}`)
      .then((res) => res.json())
      .then((data) => setCfg(data))
      .catch(() => setCfg(null));
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [menuOpen]);

  if (!cfg) {
    return (
      <main className="app-shell">
        <section className="card">
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              Loading merchant configuration...
            </div>
          </div>
        </section>
      </main>
    );
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
    window.location.href = "/merchant/manage";
  }

  const menuItems = user
    ? [
        {
          label: "Back to planner",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/";
          },
        },
        {
          label: "Manage Stores",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/merchant/manage";
          },
        },
        {
          label: "View orders",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/orders";
          },
        },
        {
          label: "Sign out",
          action: async () => {
            await signOut(auth);
            setMenuOpen(false);
          },
        },
      ]
    : [
        {
          label: "Sign in with Google",
          action: async () => {
            await signInWithPopup(auth, googleProvider);
            setMenuOpen(false);
          },
        },
      ];

  return (
    <main className="app-shell">
      <section className="card">
        <div className="card-header-row">
          <div className="card-header">
            <button 
              type="button"
              onClick={() => window.location.href = '/'}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                background: "none", 
                border: "none", 
                cursor: "pointer",
                padding: 0
              }}
            >
              <span className="app-logo" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 21v-2h16v2H4Zm4-4q-1.65 0-2.825-1.175T4 13V3h16q.825 0 1.413.588T22 5v3q0 .825-.588 1.413T20 10h-2v3q0 1.65-1.175 2.825T14 17H8Zm10-9h2V5h-2v3ZM8 15h6q.825 0 1.413-.588T16 13V5h-6v.4l1.8 1.45q.05.05.2.4v4.25q0 .2-.15.35t-.35.15h-4q-.2 0-.35-.15T7 11.5V7.25q0-.05.2-.4L9 5.4V5H6v8q0 .825.588 1.413T8 15Zm3-5ZM9 5h1h-1Z" />
                </svg>
              </span>
              <header className="app-header">Edit: {cfg.name}</header>
            </button>
          </div>

          <div className="card-header-chip" ref={menuRef}>
            <button type="button" className="chip" onClick={() => setMenuOpen((open) => !open)}>
              {user?.email || "Sign in"}
            </button>
            {menuOpen && (
              <div className="chip-menu">
                {menuItems.map((item) => (
                  <button key={item.label} type="button" onClick={item.action}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "32px" }}>
          {/* Basic Information */}
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "600", 
              color: "#111827", 
              marginBottom: "24px" 
            }}>
              Basic Information
            </h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              <div>
                <label htmlFor="merchant-name" style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#374151" 
                }}>
                  Merchant Name
                </label>
                <input
                  id="merchant-name"
                  name="merchant-name"
                  value={cfg.name}
                  onChange={(e) => setCfg({ ...cfg, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "16px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "2px solid #000",
                    borderRadius: "999px",
                    outline: "none",
                    backgroundColor: "#fff"
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="base-url" style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#374151" 
                }}>
                  Base URL
                </label>
                <input
                  id="base-url"
                  name="base-url"
                  value={cfg.baseUrl}
                  onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "16px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    border: "2px solid #000",
                    borderRadius: "999px",
                    outline: "none",
                    backgroundColor: "#fff"
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="verification-selector" style={{ 
                display: "block", 
                marginBottom: "8px", 
                fontSize: "16px", 
                fontWeight: "600", 
                color: "#374151" 
              }}>
                Verification Summary Selector
              </label>
              <input
                id="verification-selector"
                name="verification-selector"
                value={cfg.verification?.summarySelector || ""}
                onChange={(e) =>
                  setCfg({ ...cfg, verification: { ...cfg.verification, summarySelector: e.target.value } })
                }
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  border: "2px solid #000",
                  borderRadius: "999px",
                  outline: "none",
                  backgroundColor: "#fff"
                }}
              />
            </div>
          </div>

          {/* Configuration Sections */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "32px" }}>
            <div>
              <h3 style={{ 
                fontSize: "18px", 
                fontWeight: "600", 
                color: "#111827", 
                marginBottom: "16px" 
              }}>
                Selectors
              </h3>
              <textarea
                value={JSON.stringify(cfg.selectors, null, 2)}
                onChange={(e) => setCfg({ ...cfg, selectors: safeParse(e.target.value || "{}", {}) })}
                style={{
                  width: "100%",
                  height: "200px",
                  padding: "16px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  border: "2px solid #000",
                  borderRadius: "16px",
                  outline: "none",
                  backgroundColor: "#fff",
                  resize: "vertical"
                }}
              />
            </div>

            <div>
              <h3 style={{ 
                fontSize: "18px", 
                fontWeight: "600", 
                color: "#111827", 
                marginBottom: "16px" 
              }}>
                Menu Items
              </h3>
              <textarea
                value={JSON.stringify(cfg.menu || { items: [] }, null, 2)}
                onChange={(e) => setCfg({ ...cfg, menu: safeParse(e.target.value || "{}", { items: [] }) })}
                style={{
                  width: "100%",
                  height: "200px",
                  padding: "16px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  border: "2px solid #000",
                  borderRadius: "16px",
                  outline: "none",
                  backgroundColor: "#fff",
                  resize: "vertical"
                }}
              />
            </div>
          </div>

          {/* Advanced Configuration */}
          <details style={{ marginBottom: "32px" }}>
            <summary style={{ 
              cursor: "pointer", 
              fontSize: "18px", 
              fontWeight: "600", 
              color: "#111827",
              marginBottom: "16px",
              padding: "12px 0"
            }}>
              Advanced Configuration
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
              <div>
                <h4 style={{ 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#374151", 
                  marginBottom: "12px" 
                }}>
                  Normalize
                </h4>
                <textarea
                  defaultValue={JSON.stringify(cfg.normalize || {}, null, 2)}
                  onBlur={(e) => setCfg({ ...cfg, normalize: safeParse(e.target.value || "{}", {}) })}
                  style={{
                    width: "100%",
                    height: "150px",
                    padding: "12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    border: "2px solid #000",
                    borderRadius: "12px",
                    outline: "none",
                    backgroundColor: "#fff",
                    resize: "vertical"
                  }}
                />
              </div>
              <div>
                <h4 style={{ 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#374151", 
                  marginBottom: "12px" 
                }}>
                  Availability
                </h4>
                <textarea
                  defaultValue={JSON.stringify(cfg.availability || {}, null, 2)}
                  onBlur={(e) => setCfg({ ...cfg, availability: safeParse(e.target.value || "{}", {}) })}
                  style={{
                    width: "100%",
                    height: "150px",
                    padding: "12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    border: "2px solid #000",
                    borderRadius: "12px",
                    outline: "none",
                    backgroundColor: "#fff",
                    resize: "vertical"
                  }}
                />
              </div>
              <div>
                <h4 style={{ 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#374151", 
                  marginBottom: "12px" 
                }}>
                  Checkout
                </h4>
                <textarea
                  defaultValue={JSON.stringify(cfg.checkout || {}, null, 2)}
                  onBlur={(e) => setCfg({ ...cfg, checkout: safeParse(e.target.value || "{}", {}) })}
                  style={{
                    width: "100%",
                    height: "150px",
                    padding: "12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    border: "2px solid #000",
                    borderRadius: "12px",
                    outline: "none",
                    backgroundColor: "#fff",
                    resize: "vertical"
                  }}
                />
              </div>
            </div>
          </details>

          {/* Action Buttons */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            paddingTop: "24px",
            borderTop: "2px solid #e5e7eb"
          }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <button 
                onClick={save} 
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  backgroundColor: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#374151";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#000";
                }}
              >
                Save Changes
              </button>
              
              <button 
                onClick={remove} 
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  backgroundColor: "transparent",
                  color: "#dc2626",
                  border: "2px solid #dc2626",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#dc2626";
                }}
              >
                Delete Merchant
              </button>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <button
                onClick={async () => {
                  const res = await fetch("/api/merchants/validate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(cfg),
                  }).then((r) => r.json());
                  setMsg(res.ok ? "Preflight ✓ Ready" : "Preflight ✕ Missing: " + res.missing.join(", "));
                }}
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  backgroundColor: "transparent",
                  color: "#374151",
                  border: "2px solid #374151",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#374151";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#374151";
                }}
              >
                Run Preflight
              </button>
              
              <button
                onClick={() => {
                  localStorage.setItem("asaply.selectedMerchantId", id);
                  setMsg("Set as active merchant for demo.");
                }}
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  backgroundColor: "transparent",
                  color: "#059669",
                  border: "2px solid #059669",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#059669";
                }}
              >
                Use in Demo
              </button>
            </div>
          </div>

          {/* Status Message */}
          {msg && (
            <div style={{ 
              marginTop: "24px",
              padding: "16px 24px",
              backgroundColor: msg.includes("✓") ? "#dcfce7" : msg.includes("✕") ? "#fef2f2" : "#f3f4f6",
              border: `2px solid ${msg.includes("✓") ? "#bbf7d0" : msg.includes("✕") ? "#fecaca" : "#e5e7eb"}`,
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: "600",
              color: msg.includes("✓") ? "#166534" : msg.includes("✕") ? "#dc2626" : "#374151"
            }}>
              {msg}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}