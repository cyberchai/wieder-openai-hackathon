import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ORDERS_PATH = path.join(process.cwd(), ".orders.json");

type OrderEntry = {
  plan: unknown;
  merchant: string;
  at: number;
};

function readOrders(): OrderEntry[] {
  if (!fs.existsSync(ORDERS_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ORDERS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read orders file", error);
    return [];
  }
}

function writeOrders(entries: OrderEntry[]) {
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(entries, null, 2));
}

export async function GET() {
  const orders = readOrders();
  const lastTen = orders.slice(-10).reverse();
  return NextResponse.json(lastTen);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = body?.plan;
    const merchant = typeof body?.merchant === "string" ? body.merchant : "";

    if (!merchant || typeof plan === "undefined") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const orders = readOrders();
    const entry: OrderEntry = {
      plan,
      merchant,
      at: Date.now(),
    };
    orders.push(entry);
    writeOrders(orders);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to append order", error);
    return NextResponse.json({ error: "Failed to record order" }, { status: 500 });
  }
}
