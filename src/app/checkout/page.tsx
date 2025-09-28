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
  needs_confirmation?: boolean;
  questions?: string[];
}

// Voice Toggle Component
function VoiceToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
      <input 
        type="checkbox" 
        checked={enabled} 
        onChange={e => onChange(e.target.checked)}
        style={{ margin: 0 }}
      />
      Voice
    </label>
  );
}

// Confirmation Modal Component
function ConfirmModal({ 
  question, 
  onAnswer, 
  onCancel,
  voiceEnabled = false
}: {
  question: string; 
  onAnswer: (a: string) => void; 
  onCancel: () => void;
  voiceEnabled?: boolean;
}) {
  const [textInput, setTextInput] = useState("");
  const [isListening, setIsListening] = useState(false);

  const handleTextSubmit = () => {
    console.log('handleTextSubmit called with:', textInput.trim());
    if (textInput.trim()) {
      onAnswer(textInput.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextSubmit();
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTextInput(transcript);
      setIsListening(false);
      onAnswer(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      display: "grid",
      placeItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "#fff",
        padding: "24px",
        borderRadius: "12px",
        maxWidth: "500px",
        width: "90%",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
      }}>
        <p style={{ marginBottom: "16px", fontSize: "16px", lineHeight: "1.5" }}>
          {question}
        </p>
        
        {/* Text Input */}
        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response here..."
            style={{
              width: "100%",
              padding: "12px",
              border: "2px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "16px",
              outline: "none"
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button 
            onClick={() => {
              console.log('Submit button clicked');
              handleTextSubmit();
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Submit
          </button>
          
          {voiceEnabled && (
            <button 
              onClick={startListening}
              disabled={isListening}
              style={{
                padding: "8px 16px",
                backgroundColor: isListening ? "#ef4444" : "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              {isListening ? "Listening..." : "🎤 Voice"}
            </button>
          )}
          
          <button 
            onClick={() => {
              console.log('Yes button clicked');
              onAnswer("yes");
            }} 
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              color: "#000",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Yes
          </button>
          <button 
            onClick={() => {
              console.log('No button clicked');
              onAnswer("no");
            }} 
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              color: "#000",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            No
          </button>
          <button 
            onClick={onCancel} 
            style={{
              marginLeft: "auto",
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "#6b7280",
              border: "none",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Order validation function
function isOrderConfirmable(order: any) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) return false;
  if (order.needs_confirmation) return false;
  for (const item of order.items) {
    if (!item.menu_item || !item.qty) return false;
  }
  return true;
}

export default function CheckoutPage() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [orderData, setOrderData] = useState<OrderProcessingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [askQuestion, setAskQuestion] = useState<string | null>(null);
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
        const data = JSON.parse(orderDataStr);
        setOrderData(data);
        
        // Check if we need to ask confirmation questions
        if (data.needs_confirmation && data.questions && data.questions.length > 0) {
          setAskQuestion(data.questions[0]);
        }
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
    if (orderData && isOrderConfirmable(orderData)) {
      sessionStorage.setItem('orderData', JSON.stringify(orderData));
      window.location.href = '/checkout/payment';
    }
  };

  const editOrder = () => {
    window.location.href = '/';
  };

  const handleConfirmationAnswer = async (answer: string) => {
    console.log('handleConfirmationAnswer called with:', answer);
    if (!orderData) {
      console.log('No orderData available');
      return;
    }
    
    try {
      // Get the auth token for the API call
      const token = await auth.currentUser?.getIdToken();
      console.log('Auth token available:', !!token);
      
      // Call the follow-up API to process the user's response
      const response = await fetch('/api/order-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          previousOrder: orderData,
          userResponse: answer
        })
      });

      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to process follow-up: ${response.status}`);
      }

      const followupData = await response.json();
      console.log('Followup data received:', followupData);
      
      // Update the order with the refined response
      const updatedOrder = {
        ...orderData,
        needs_confirmation: followupData.needs_confirmation,
        questions: followupData.questions || []
      };
      
      setOrderData(updatedOrder);
      sessionStorage.setItem('orderData', JSON.stringify(updatedOrder));
      
      if (followupData.needs_confirmation && followupData.questions && followupData.questions.length > 0) {
        // Ask the next question
        console.log('Asking next question:', followupData.questions[0]);
        setAskQuestion(followupData.questions[0]);
      } else {
        // No more questions needed
        console.log('No more questions needed, closing modal');
        setAskQuestion(null);
      }
      
    } catch (error) {
      console.error('Error handling confirmation:', error);
      // Fallback: if there's an error, just close the modal
      console.log('Closing modal due to error');
      
      // If user said "yes" and API failed, assume they want to proceed
      if (answer.toLowerCase() === 'yes') {
        const updatedOrder = {
          ...orderData,
          needs_confirmation: false,
          questions: []
        };
        setOrderData(updatedOrder);
        sessionStorage.setItem('orderData', JSON.stringify(updatedOrder));
      }
      
      setAskQuestion(null);
    }
  };

  const handleConfirmationCancel = () => {
    setAskQuestion(null);
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
              <header className="app-header">Review Order</header>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <VoiceToggle enabled={voiceEnabled} onChange={setVoiceEnabled} />
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
              disabled={!isOrderConfirmable(orderData)}
              style={{
                padding: "16px 32px",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #000",
                borderRadius: "999px",
                backgroundColor: isOrderConfirmable(orderData) ? "#000" : "#6b7280",
                color: "#fff",
                cursor: isOrderConfirmable(orderData) ? "pointer" : "not-allowed",
                opacity: isOrderConfirmable(orderData) ? 1 : 0.6
              }}
            >
              {isOrderConfirmable(orderData) ? "Proceed to Payment" : "Confirm selection first"}
            </button>
          </div>
        </div>
      </section>
      
      {/* Confirmation Modal */}
      {askQuestion && (
        <ConfirmModal
          question={askQuestion}
          onAnswer={handleConfirmationAnswer}
          onCancel={handleConfirmationCancel}
          voiceEnabled={voiceEnabled}
        />
      )}
    </main>
  );
}
