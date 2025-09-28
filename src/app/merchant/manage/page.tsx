"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "@/src/lib/firebaseClient";
import type { MerchantConfig } from "@/src/types/merchant";

export default function ManageMerchants() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [merchants, setMerchants] = useState<MerchantConfig[]>([]);
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
    let active = true;
    
    if (!user?.email) {
      console.log("No user email, clearing merchants");
      setMerchants([]);
      return;
    }
    
    console.log("Fetching merchants for email:", user.email);
    
    fetch(`/api/merchants?ownerEmail=${encodeURIComponent(user.email)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        console.log("Received merchants data:", data);
        setMerchants(Array.isArray(data?.merchants) ? data.merchants : []);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Error fetching merchants:", error);
        setMerchants([]);
      });
    return () => {
      active = false;
    };
  }, [user?.email]);

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

  const filteredMerchants = useMemo(() => {
    return merchants; // No need to filter client-side anymore
  }, [merchants]);

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

  return (
    <main className="app-shell">
      <section className="card manage-card">
        <div className="card-header-row">
          <div className="card-header">
            <span className="app-logo" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 21v-2h16v2H4Zm4-4q-1.65 0-2.825-1.175T4 13V3h16q.825 0 1.413.588T22 5v3q0 .825-.588 1.413T20 10h-2v3q0 1.65-1.175 2.825T14 17H8Zm10-9h2V5h-2v3ZM8 15h6q.825 0 1.413-.588T16 13V5h-6v.4l1.8 1.45q.05.05.2.4v4.25q0 .2-.15.35t-.35.15h-4q-.2 0-.35-.15T7 11.5V7.25q0-.05.2-.4L9 5.4V5H6v8q0 .825.588 1.413T8 15Zm3-5ZM9 5h1h-1Z" />
              </svg>
            </span>
            <header className="app-header">Manage Stores</header>
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

        <div className="manage-actions">
          <Link className="manage-primary" href="/merchant/new">
            + Add store / config
          </Link>
          <Link className="manage-secondary" href="/">
            Back to planner
          </Link>
        </div>

        <div className="manage-list">
          {!user && <p className="manage-empty">Sign in to manage your merchants.</p>}

          {user && filteredMerchants.length === 0 && (
            <p className="manage-empty">
              No merchants yet. Create your first menu to start planning orders.
            </p>
          )}

          {user &&
            filteredMerchants.map((merchant) => (
              <div key={merchant.id} className="manage-item">
                <div className="manage-info">
                  <h3>{merchant.name}</h3>
                  <p>{merchant.baseUrl}</p>
                </div>
                <div className="manage-buttons">
                  <Link href={`/merchant/${merchant.id}`} className="manage-link">
                    Edit config
                  </Link>
                </div>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}