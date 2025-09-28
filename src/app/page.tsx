"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "@/src/lib/firebaseClient";
import type { OrderJSON } from "@/src/types/order";

const STORAGE_KEY = "asaply.selectedMerchant";

type ConfigKey = "a" | "b";


const LEGACY_MERCHANTS = [
  { id: "legacy:a", name: "ASAPly Demo Café A (Tall/Grande/Venti)" },
  { id: "legacy:b", name: "ASAPly Demo Café B (Small/Medium/Large)" },
];

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
  const [isWorking, setIsWorking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const placeholderSuggestions = [
    "Large oat latte + chocolate croissant at 12:30 pickup",
    "Double Americano 8oz",
    "Hot matcha latte with brown sugar syrup",
    "Iced mocha latte no cold foam"
  ];
  
  const [promptPlaceholder, setPromptPlaceholder] = useState(placeholderSuggestions[0]);
  const [isTyping, setIsTyping] = useState(false);
  const [cloudMerchants, setCloudMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>(LEGACY_MERCHANTS[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const comboRef = useRef<HTMLInputElement | null>(null);
  const placeholderIndexRef = useRef(0);
  const currentTextRef = useRef(placeholderSuggestions[0]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mergedMerchants = useMemo(
    () => [
      ...LEGACY_MERCHANTS,
      ...cloudMerchants.map((merchant) => ({ id: `firestore:${merchant.id}`, name: merchant.name })),
    ],
    [cloudMerchants],
  );

  const filteredMerchants = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return mergedMerchants.filter((merchant) => merchant.name.toLowerCase().includes(term));
  }, [mergedMerchants, searchTerm]);

  const updateSelection = (value: string) => {
    setSelectedMerchant(value);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, value);
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEmail(null);
        setToken(null);
        return;
      }
      setEmail(user.email);
      setToken(await user.getIdToken());
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
          updateSelection(normalized);
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
            updateSelection(normalized);
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
      updateSelection(mergedMerchants[0].id);
    }
  }, [mergedMerchants, selectedMerchant]);


  useEffect(() => {
    if (!listOpen) return;
    const onOutside = (event: MouseEvent | TouchEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [listOpen]);

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

  // Auto-focus input on page load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Add keyboard shortcuts for Cmd+F / Ctrl+F to focus input and Cmd+E / Ctrl+E to focus combo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key to close combo menu
      if (event.key === 'Escape') {
        if (listOpen) {
          setListOpen(false);
          if (comboRef.current) {
            comboRef.current.blur();
          }
        }
        return;
      }
      
      if (event.metaKey || event.ctrlKey) {
        if (event.key === 'f') {
          event.preventDefault(); // Prevent browser's default find behavior
          if (inputRef.current) {
            inputRef.current.focus();
          }
        } else if (event.key === 'e') {
          event.preventDefault(); // Prevent browser's default search behavior
          if (comboRef.current && !comboRef.current.disabled) {
            comboRef.current.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [listOpen]);

  // Simple placeholder rotation (let's start with this to test)
  useEffect(() => {
    const rotatePlaceholder = () => {
      console.log('rotatePlaceholder called', { q: q.trim(), isTyping });
      // Only rotate if user is not actively typing (input is empty)
      if (!q.trim()) {
        const nextIndex = (placeholderIndexRef.current + 1) % placeholderSuggestions.length;
        const nextText = placeholderSuggestions[nextIndex];
        console.log('Rotating to:', nextText);
        setPromptPlaceholder(nextText);
        placeholderIndexRef.current = nextIndex;
      }
    };
    
    const interval = setInterval(rotatePlaceholder, 3000); // 3 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, [q, placeholderSuggestions]);

  // Blinking cursor effect when not typing (disabled for now)
  // useEffect(() => {
  //   if (!isTyping && !q.trim()) {
  //     let showCursor = true;
      
  //     const blinkCursor = () => {
  //       const textWithoutCursor = promptPlaceholder.replace('|', '');
  //       const newText = showCursor ? textWithoutCursor + '|' : textWithoutCursor;
  //       setPromptPlaceholder(newText);
  //       showCursor = !showCursor;
  //     };
      
  //     const interval = setInterval(blinkCursor, 500); // Blink every 500ms
      
  //     return () => clearInterval(interval);
  //   }
  // }, [isTyping, q, promptPlaceholder]);

  const handlePromptSubmit = async () => {
    if (isWorking) return;
    const trimmed = q.trim();
    if (!trimmed) return;
    if (!token) {
      setPromptPlaceholder("Sign in to run orders.");
      return;
    }

    setIsWorking(true);
    setIsThinking(true);
    setPromptPlaceholder("AI is thinking...");

    try {
      // Prepare merchant data for the new API
      let merchantId: string | undefined;
      let configKey: string | undefined;

      if (selectedMerchant.startsWith("firestore:")) {
        merchantId = selectedMerchant.slice("firestore:".length);
      } else {
        configKey = selectedMerchant.replace("legacy:", "") || "a";
      }

      setPromptPlaceholder("🧠 Processing your order...");

      const orderRes = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          query: trimmed,
          merchantId,
          configKey
        }),
      });
      
      const orderPayload = await orderRes.json();
      if (!orderRes.ok) {
        const errorMsg = typeof orderPayload?.error === "string" ? orderPayload.error : "Order processing failed";
        throw new Error(errorMsg);
      }

      // Store order data and redirect to checkout
      sessionStorage.setItem('orderData', JSON.stringify(orderPayload));
      setPromptPlaceholder("Order processed successfully!");
      setQ("");
      
      // Small delay to show success message
      setTimeout(() => {
        window.location.href = '/checkout';
      }, 1000);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process. Try again.";
      setPromptPlaceholder(`❌ ${message}`);
      
      // Reset placeholder after 3 seconds
      setTimeout(() => {
        setPromptPlaceholder("Large oat latte + chocolate croissant at 12:30 pickup");
      }, 3000);
    } finally {
      setIsWorking(false);
      setIsThinking(false);
    }
  };

  const handleSelectMerchant = (id: string, name: string) => {
    updateSelection(id);
    setSearchTerm(name);
    setListOpen(false);
  };

  const chipLabel = email || "Sign in";

  const menuItems = email
    ? [
        {
          label: "View orders",
          action: () => {
            setMenuOpen(false);
            window.location.href = "/orders";
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
            <span className="app-logo" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 21v-2h16v2H4Zm4-4q-1.65 0-2.825-1.175T4 13V3h16q.825 0 1.413.588T22 5v3q0 .825-.588 1.413T20 10h-2v3q0 1.65-1.175 2.825T14 17H8Zm10-9h2V5h-2v3ZM8 15h6q.825 0 1.413-.588T16 13V5h-6v.4l1.8 1.45q.05.05.2.4v4.25q0 .2-.15.35t-.35.15h-4q-.2 0-.35-.15T7 11.5V7.25q0-.05.2-.4L9 5.4V5H6v8q0 .825.588 1.413T8 15Zm3-5ZM9 5h1h-1Z" />
              </svg>
            </span>
            <header className="app-header">
              <i>asap</i>ly
            </header>
          </div>
          <div className="card-header-chip" ref={menuRef}>
            <button
              type="button"
              className="chip"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {chipLabel}
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

        <div ref={dropdownRef} className="combo">
          <input
            ref={comboRef}
            className="combo-input"
            placeholder="Where can we get something delicious?"
            value={searchTerm}
            onFocus={() => setListOpen(true)}
            onBlur={() => {
              // Delay hiding to allow clicking on menu items
              setTimeout(() => setListOpen(false), 150);
            }}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setListOpen(true);
            }}
            disabled={mergedMerchants.length === 0}
          />
          {listOpen && filteredMerchants.length > 0 && (
            <div className="combo-list" role="listbox">
              {filteredMerchants.map((merchant) => (
                <button
                  key={merchant.id}
                  type="button"
                  className="combo-item"
                  onMouseDown={() => handleSelectMerchant(merchant.id, merchant.name)}
                >
                  {merchant.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="prompt-wrapper">
          <input
            ref={inputRef}
            id="prompt-input"
            name="prompt-input"
            className="prompt-input"
            placeholder={promptPlaceholder}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handlePromptSubmit();
              }
            }}
            disabled={isWorking}
            style={{
              border: "none",
              background: "transparent",
              outline: "none"
            }}
          />
          
          {/* Thinking Animation */}
          {isThinking && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginTop: "20px"
            }}>
              <div className="thinking-card" />
              <span style={{
                fontSize: "14px",
                color: "#6b7280",
                fontWeight: "500"
              }}>
                aisap thinking...
              </span>
            </div>
          )}
          
          {/* <p className="prompt-hint">Press Enter to send. We'll plan and execute instantly.</p> */}
        </div>
      </section>
    </main>
  );
}

