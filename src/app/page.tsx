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
const HOLD_DURATION = 600;

type ConfigKey = "a" | "b";

type ExecuteResponse = {
  ok?: boolean;
  exitCode?: number;
  logs?: string;
  error?: string;
};

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
  const [q, setQ] = useState("Large oat latte + chocolate croissant at 12:30 pickup");
  const [isWorking, setIsWorking] = useState(false);
  const [promptPlaceholder, setPromptPlaceholder] = useState(
    "Large oat latte + chocolate croissant at 12:30 pickup",
  );
  const [cloudMerchants, setCloudMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>(LEGACY_MERCHANTS[0].id);
  const [searchTerm, setSearchTerm] = useState(LEGACY_MERCHANTS[0].name);
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);

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
    const match = mergedMerchants.find((merchant) => merchant.id === selectedMerchant);
    if (match) setSearchTerm(match.name);
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

  const handlePromptSubmit = async () => {
    if (isWorking) return;
    const trimmed = q.trim();
    if (!trimmed) return;
    if (!token) {
      setPromptPlaceholder("Sign in to run orders.");
      return;
    }

    setIsWorking(true);
    setPromptPlaceholder("Planning order…");

    try {
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: trimmed }),
      });
      const planPayload = await planRes.json();
      if (!planRes.ok) {
        throw new Error(typeof planPayload?.error === "string" ? planPayload.error : "Planning failed");
      }
      const planData = planPayload as OrderJSON;
      setPromptPlaceholder("Executing order…");
      await executeOrder(planData, token, selectedMerchant);
      setPromptPlaceholder("Order submitted ✓");
      setQ("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process. Try again.";
      setPromptPlaceholder(message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleSelectMerchant = (id: string, name: string) => {
    updateSelection(id);
    setSearchTerm(name);
    setListOpen(false);
  };

  const chipLabel = email ? email[0]?.toUpperCase() : "?";

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

  const navigateToSwitch = () => {
    window.location.href = "/merchant/manage";
  };

  const handleChipCancel = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    holdTriggered.current = false;
  };

  const handleChipPressStart = () => {
    holdTriggered.current = false;
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
    holdTimeout.current = setTimeout(() => {
      holdTriggered.current = true;
      setMenuOpen(false);
      navigateToSwitch();
    }, HOLD_DURATION);
  };

  const handleChipPressEnd = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    if (!holdTriggered.current) {
      setMenuOpen((open) => !open);
    }
    holdTriggered.current = false;
  };

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
              onMouseDown={handleChipPressStart}
              onMouseUp={handleChipPressEnd}
              onMouseLeave={handleChipCancel}
              onTouchStart={handleChipPressStart}
              onTouchEnd={handleChipPressEnd}
              onTouchCancel={handleChipCancel}
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
            className="combo-input"
            placeholder="Search merchants"
            value={searchTerm}
            onFocus={() => setListOpen(true)}
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
          />
          <p className="prompt-hint">Press Enter to send. We’ll plan and execute instantly.</p>
        </div>
      </section>
    </main>
  );
}

async function executeOrder(planData: OrderJSON, token: string, selection: string) {
  const payload: Record<string, unknown> = { plan: planData };
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

  const execRes = await fetch("/api/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const execData: ExecuteResponse = await execRes.json();
  if (!execRes.ok || !execData.ok) {
    throw new Error(typeof execData?.error === "string" ? execData.error : "Execution failed");
  }

  fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan: planData, merchant: merchantIdentifier, status: "PASS" }),
  }).catch(() => {});
}
