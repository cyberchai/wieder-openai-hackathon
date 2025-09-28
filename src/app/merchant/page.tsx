"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { id: string; name: string };

export default function MerchantList() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/merchants")
      .then((res) => res.json())
      .then((data) => setRows(data.merchants || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Merchants</h1>
      <div className="flex items-center gap-3">
        <Link className="underline" href="/merchant/new">
          + New merchant
        </Link>
        <Link className="underline" href="/">
          Home
        </Link>
      </div>
      <ul className="list-disc pl-5">
        {rows.map((r) => (
          <li key={r.id} className="py-1">
            <Link className="underline" href={`/merchant/${r.id}`}>
              {r.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
