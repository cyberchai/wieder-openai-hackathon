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

export default function PaymentPage() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [orderData, setOrderData] = useState<OrderProcessingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'google'>('card');
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
    // Get order data from session storage
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

  const processPayment = async () => {
    if (!orderData || !user) return;
    
    setProcessing(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Save order to database
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            plan: orderData.order,
            merchant: orderData.merchant.id,
            status: "PASS"
          }),
        });
        
        if (response.ok) {
          // Clear session storage and redirect to confirmation
          sessionStorage.removeItem('orderData');
          window.location.href = '/checkout/confirmation';
        } else {
          throw new Error('Failed to save order');
        }
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    window.location.href = '/checkout';
  };

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", color: "#6b7280" }}>Loading payment...</div>
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

  const { order, merchant } = orderData;
  const totalItems = order.items.reduce((sum, item) => sum + (item.qty || 1), 0);
  
  // Calculate total from order data or show "Price TBD" if no pricing available
  const calculateTotal = () => {
    // Check if we have pricing data in the order
    const hasPricing = order.items.some(item => item.price || item.line_total);
    
    if (hasPricing) {
      return order.items.reduce((sum, item) => {
        return sum + (item.line_total || (item.price || 0) * (item.qty || 1));
      }, 0);
    }
    
    return null; // No pricing available
  };
  
  const orderTotal = calculateTotal();
  const showPriceTBD = orderTotal === null;

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
              <header className="app-header">Payment</header>
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
          {/* Order Summary */}
          <div style={{ 
            marginBottom: "32px",
            padding: "24px",
            border: "2px solid #e5e7eb",
            borderRadius: "16px",
            backgroundColor: "#f8fafc"
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
              Order Summary
            </h2>
            <div style={{ fontSize: "16px", color: "#6b7280", marginBottom: "8px" }}>
              {merchant.name}
            </div>
            <div style={{ fontSize: "16px", color: "#6b7280", marginBottom: "16px" }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''} • {order.fulfillment.type} at {order.fulfillment.time}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: "600", color: "#111827" }}>Total</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                {showPriceTBD ? (
                  <>
                    <span style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
                      Price TBD
                    </span>
                    <span style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                      at pickup
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
                    ${orderTotal.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
              Payment Method
            </h3>
            
            {/* Credit Card */}
            <div 
              style={{
                marginBottom: "12px",
                padding: "20px",
                border: paymentMethod === 'card' ? "2px solid #000" : "2px solid #e5e7eb",
                borderRadius: "12px",
                backgroundColor: paymentMethod === 'card' ? "#f8fafc" : "#fff",
                cursor: "pointer"
              }}
              onClick={() => setPaymentMethod('card')}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: paymentMethod === 'card' ? "2px solid #000" : "2px solid #e5e7eb",
                  backgroundColor: paymentMethod === 'card' ? "#000" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {paymentMethod === 'card' && (
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#fff"
                    }} />
                  )}
                </div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                  Credit Card
                </div>
                <div style={{ marginLeft: "auto", fontSize: "14px", color: "#6b7280" }}>
                  •••• •••• •••• 4242
                </div>
              </div>
            </div>

            {/* Apple Pay */}
            <div 
              style={{
                marginBottom: "12px",
                padding: "20px",
                border: paymentMethod === 'apple' ? "2px solid #000" : "2px solid #e5e7eb",
                borderRadius: "12px",
                backgroundColor: paymentMethod === 'apple' ? "#f8fafc" : "#fff",
                cursor: "pointer"
              }}
              onClick={() => setPaymentMethod('apple')}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: paymentMethod === 'apple' ? "2px solid #000" : "2px solid #e5e7eb",
                  backgroundColor: paymentMethod === 'apple' ? "#000" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {paymentMethod === 'apple' && (
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#fff"
                    }} />
                  )}
                </div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" fill="#000000"/>
                  </svg>
                  Apple Pay
                </div>
              </div>
            </div>

            {/* Google Pay */}
            <div 
              style={{
                padding: "20px",
                border: paymentMethod === 'google' ? "2px solid #000" : "2px solid #e5e7eb",
                borderRadius: "12px",
                backgroundColor: paymentMethod === 'google' ? "#f8fafc" : "#fff",
                cursor: "pointer"
              }}
              onClick={() => setPaymentMethod('google')}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: paymentMethod === 'google' ? "2px solid #000" : "2px solid #e5e7eb",
                  backgroundColor: paymentMethod === 'google' ? "#000" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {paymentMethod === 'google' && (
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#fff"
                    }} />
                  )}
                </div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                  G Google Pay
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <button
              onClick={goBack}
              disabled={processing}
              style={{
                padding: "16px 32px",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #000",
                borderRadius: "999px",
                backgroundColor: "#fff",
                color: "#000",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1
              }}
            >
              Back
            </button>
            <button
              onClick={processPayment}
              disabled={processing}
              style={{
                padding: "16px 32px",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #000",
                borderRadius: "999px",
                backgroundColor: "#000",
                color: "#fff",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1
              }}
            >
              {processing ? "Processing..." : showPriceTBD ? "Place Order (Price TBD)" : `Pay $${orderTotal.toFixed(2)}`}
            </button>
          </div>

          {processing && (
            <div style={{ 
              marginTop: "24px", 
              textAlign: "center",
              fontSize: "14px",
              color: "#6b7280"
            }}>
              Processing your payment...
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
