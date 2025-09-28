"use client";

import { useEffect, useRef, useState } from "react";
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "@/src/lib/firebaseClient";

export default function ConfirmationPage() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
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

  // Generate order ID only on client side to avoid hydration mismatch
  useEffect(() => {
    setOrderId(`ORD-${Date.now().toString(36).toUpperCase()}`);
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

  const startNewOrder = () => {
    window.location.href = '/';
  };

  const viewOrders = () => {
    window.location.href = '/orders';
  };

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
              <header className="app-header">Order Confirmed</header>
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

        <div style={{ padding: "48px 32px", textAlign: "center" }}>
          {/* Success Icon */}
          <div style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            backgroundColor: "#dcfce7",
            border: "4px solid #16a34a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 32px"
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Success Message */}
          <h1 style={{ 
            fontSize: "28px", 
            fontWeight: "700", 
            color: "#111827",
            marginBottom: "16px"
          }}>
            Order Placed Successfully!
          </h1>

          <p style={{ 
            fontSize: "18px", 
            color: "#6b7280",
            marginBottom: "32px",
            lineHeight: "1.5"
          }}>
            Your order has been confirmed and is being prepared. 
            You'll receive a confirmation email shortly.
          </p>

          {/* Order Details */}
          <div style={{
            marginBottom: "48px",
            padding: "24px",
            border: "2px solid #e5e7eb",
            borderRadius: "16px",
            backgroundColor: "#f8fafc",
            maxWidth: "400px",
            margin: "0 auto 48px"
          }}>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
              Order Details
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "4px" }}>
              Order ID: {orderId}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "4px" }}>
              Estimated pickup: 15-20 minutes
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>
              Payment: Processed successfully
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={startNewOrder}
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
              Place Another Order
            </button>
            <button
              onClick={viewOrders}
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
              View All Orders
            </button>
          </div>

          {/* Additional Info */}
          <div style={{
            marginTop: "48px",
            padding: "20px",
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "12px",
            maxWidth: "500px",
            margin: "48px auto 0"
          }}>
            <div style={{ fontSize: "14px", color: "#92400e", lineHeight: "1.5" }}>
              <strong style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 2H7C5.89543 2 5 2.89543 5 4V20C5 21.1046 5.89543 22 7 22H17C18.1046 22 19 21.1046 19 20V4C19 2.89543 18.1046 2 17 2Z" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 18H12.01" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Pro Tip:
              </strong> You can track your order status and get updates 
              by checking your order history in the app.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
