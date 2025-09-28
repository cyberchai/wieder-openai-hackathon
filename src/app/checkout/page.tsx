"use client";

import { useEffect, useRef, useState } from "react";
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "@/src/lib/firebaseClient";
import type { OrderJSON } from "@/src/types/order";

interface OrderProcessingResponse {
  order: OrderJSON;
  suggestions?: string[];
  clarifications?: string[];
  merchant: {
    id: string;
    name: string;
    menu: any;
  };
}

export default function CheckoutPage() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [orderData, setOrderData] = useState<OrderProcessingResponse | null>(null);
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
    // Get order data from session storage or URL params
    const orderDataStr = sessionStorage.getItem('orderData');
    if (orderDataStr) {
      try {
        setOrderData(JSON.parse(orderDataStr));
      } catch (error) {
        console.error('Failed to parse order data:', error);
      }
    }
    setLoading(false);
  }, []);

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

  const proceedToPayment = () => {
    if (orderData) {
      sessionStorage.setItem('orderData', JSON.stringify(orderData));
      window.location.href = '/checkout/payment';
    }
  };

  const editOrder = () => {
    window.location.href = '/';
  };

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", color: "#6b7280" }}>Loading order...</div>
          </div>
        </section>
      </main>
    );
  }

  if (!orderData) {
    return (
      <main className="app-shell">
        <section className="card">
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", color: "#6b7280", marginBottom: "24px" }}>
              No order found
            </div>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #000",
                borderRadius: "999px",
                backgroundColor: "#000",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              Start New Order
            </button>
          </div>
        </section>
      </main>
    );
  }

  const { order, merchant, suggestions, clarifications } = orderData;

  return (
    <main className="app-shell">
      <section className="card">
        <div className="card-header-row">
          <div className="card-header">
            <span className="app-logo" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 21v-2h16v2H4Zm4-4q-1.65 0-2.825-1.175T4 13V3h16q.825 0 1.413.588T22 5v3q0 .825-.588 1.413T20 10h-2v3q0 1.65-1.175 2.825T14 17H8Zm10-9h2V5h-2v3ZM8 15h6q.825 0 1.413-.588T16 13V5h-6v.4l1.8 1.45q.05.05.2.4v4.25q0 .2-.15.35t-.35.15h-4q-.2 0-.35-.15T7 11.5V7.25q0-.05.2-.4L9 5.4V5H6v8q0 .825.588 1.413T8 15Zm3-5ZM9 5h1h-1Z" />
              </svg>
            </span>
            <header className="app-header">Review Order</header>
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
          {/* Merchant Info */}
          <div style={{ 
            marginBottom: "32px",
            padding: "24px",
            border: "2px solid #000",
            borderRadius: "16px",
            backgroundColor: "#f8fafc"
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#111827" }}>
              {merchant.name}
            </h2>
            <p style={{ fontSize: "16px", color: "#6b7280" }}>
              {order.fulfillment.type === "pickup" ? "Pickup" : "Delivery"} at {order.fulfillment.time}
            </p>
          </div>

          {/* Order Items */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
              Your Order
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {order.items.map((item, index) => (
                <div 
                  key={index}
                  style={{
                    padding: "16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    backgroundColor: "#fff"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                        {item.name}
                        {item.size && ` (${item.size})`}
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                          {item.modifiers.join(", ")}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                      {item.qty || 1}x
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
              Customer Information
            </h3>
            <div style={{
              padding: "16px",
              border: "2px solid #e5e7eb",
              borderRadius: "12px",
              backgroundColor: "#fff"
            }}>
              <div style={{ fontSize: "16px", color: "#111827" }}>
                <strong>Name:</strong> {order.customer.name}
              </div>
              <div style={{ fontSize: "16px", color: "#111827", marginTop: "8px" }}>
                <strong>Phone:</strong> {order.customer.phone}
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                Suggestions
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {suggestions.map((suggestion, index) => (
                  <div 
                    key={index}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: "#fef3c7",
                      border: "1px solid #f59e0b",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#92400e"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21Z" fill="#fbbf24"/>
                        <path d="M12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2Z" fill="#fbbf24"/>
                      </svg>
                      {suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clarifications */}
          {clarifications && clarifications.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                Need Clarification
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {clarifications.map((clarification, index) => (
                  <div 
                    key={index}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: "#fef2f2",
                      border: "1px solid #ef4444",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#dc2626"
                    }}
                  >
                    ❓ {clarification}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <button
              onClick={editOrder}
              style={{
                padding: "16px 32px",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #000",
                borderRadius: "999px",
                backgroundColor: "#fff",
                color: "#000",
                cursor: "pointer"
              }}
            >
              Edit Order
            </button>
            <button
              onClick={proceedToPayment}
              style={{
                padding: "16px 32px",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #000",
                borderRadius: "999px",
                backgroundColor: "#000",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              Proceed to Payment
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
