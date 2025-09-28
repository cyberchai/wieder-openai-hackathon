"use client";

import { useEffect, useRef, useState } from "react";
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "@/src/lib/firebaseClient";

interface OrderEntry {
  id: string;
  plan: {
    items?: Array<{ name?: string }>;
  };
  merchant: string;
  requestedBy?: string;
  status?: "PASS" | "FAIL" | "UNKNOWN";
  createdAt: number | null;
}

const LEGACY_MERCHANTS = [
  { id: "legacy:a", name: "ASAPly Demo Café A (Tall/Grande/Venti)" },
  { id: "legacy:b", name: "ASAPly Demo Café B (Small/Medium/Large)" },
];

export default function OrdersPage() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) throw new Error("Failed to fetch orders");
        const data = (await res.json()) as { orders?: OrderEntry[] };
        setOrders(data.orders || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const getMerchantName = (merchantId: string): string => {
    // Handle legacy merchants
    if (merchantId === "a" || merchantId === "b") {
      const legacyMerchant = LEGACY_MERCHANTS.find(m => m.id === `legacy:${merchantId}`);
      return legacyMerchant?.name || merchantId;
    }
    
    // Handle legacy: prefixed merchants
    if (merchantId.startsWith("legacy:")) {
      const legacyKey = merchantId.replace("legacy:", "");
      const legacyMerchant = LEGACY_MERCHANTS.find(m => m.id === `legacy:${legacyKey}`);
      return legacyMerchant?.name || legacyKey;
    }
    
    // Handle firestore: prefixed merchants (these would need to be fetched from the merchants API)
    if (merchantId.startsWith("firestore:")) {
      return merchantId.replace("firestore:", "");
    }
    
    // Fallback to the original ID
    return merchantId;
  };

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
          label: "Manage merchants",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/merchant/manage";
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
              <header className="app-header">Recent Orders</header>
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
          <p style={{ 
            fontSize: "16px", 
            color: "#6b7280", 
            marginBottom: "32px",
            lineHeight: "1.5"
          }}>
            View your recent orders.
          </p>

          {loading ? (
            <div style={{ 
              textAlign: "center", 
              padding: "48px 24px",
              color: "#6b7280",
              fontSize: "16px"
            }}>
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              padding: "48px 24px",
              color: "#6b7280",
              fontSize: "16px"
            }}>
              No orders recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {orders.map((order) => {
                const firstItem = order.plan?.items?.[0]?.name || "(no items)";
                const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
                const allItems = order.plan?.items?.map(item => item.name).filter(Boolean).join(", ") || "No items";
                
                return (
                  <div 
                    key={order.id} 
                    style={{
                      border: "2px solid #000",
                      borderRadius: "16px",
                      padding: "24px",
                      backgroundColor: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px"
                    }}>
                      <div style={{ flex: "1", minWidth: "200px" }}>
                        <div style={{ 
                          fontSize: "14px", 
                          color: "#6b7280", 
                          marginBottom: "8px",
                          fontWeight: "500"
                        }}>
                          {createdAt.toLocaleString()}
                        </div>
                        <div style={{ 
                          fontSize: "18px", 
                          fontWeight: "600", 
                          color: "#111827",
                          marginBottom: "8px"
                        }}>
                          {allItems}
                        </div>
                        <div style={{ 
                          fontSize: "14px", 
                          color: "#6b7280",
                          fontWeight: "500"
                        }}>
                          {getMerchantName(order.merchant)}
                        </div>
                      </div>
                      
                      <div style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "flex-end",
                        gap: "8px"
                      }}>
                        {order.status && (
                          <div style={{
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                            backgroundColor: order.status === "PASS" ? "#dcfce7" : order.status === "FAIL" ? "#fef2f2" : "#f3f4f6",
                            color: order.status === "PASS" ? "#166534" : order.status === "FAIL" ? "#dc2626" : "#374151",
                            border: `1px solid ${order.status === "PASS" ? "#bbf7d0" : order.status === "FAIL" ? "#fecaca" : "#e5e7eb"}`
                          }}>
                            {order.status === "PASS" ? "ORDERED" : order.status}
                          </div>
                        )}
                        {order.requestedBy && (
                          <div style={{ 
                            fontSize: "12px", 
                            color: "#9ca3af",
                            fontWeight: "500"
                          }}>
                            {order.requestedBy}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
