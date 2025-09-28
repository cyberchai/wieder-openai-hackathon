"use client";

import { useEffect, useState } from "react";

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Recent Orders</h1>
        <p className="text-sm text-gray-600">
          Only successful (verified) orders appear here. Failed runs are excluded automatically.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const firstItem = order.plan?.items?.[0]?.name || "(no items)";
            const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
            return (
              <li key={order.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="text-xs text-gray-500">{createdAt.toLocaleString()}</div>
                <div className="font-medium">Merchant: {order.merchant}</div>
                <div className="text-sm text-gray-700">First item: {firstItem}</div>
                {order.requestedBy && (
                  <div className="text-xs text-gray-400">Requested by: {order.requestedBy}</div>
                )}
                {order.status && (
                  <div className="text-xs text-green-600 font-semibold">Status: {order.status}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
