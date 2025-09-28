import { adminDb, FieldValue } from "@/src/lib/firebaseAdmin";
import type { MerchantConfig } from "@/src/types/merchant";

const MERCHANTS = "merchantConfigs";
const ORDERS = "orders";

export async function listMerchants(): Promise<MerchantConfig[]> {
  const snap = await adminDb.collection(MERCHANTS).orderBy("name").get();
  return snap.docs.map((d) => {
    const data = d.data() as MerchantConfig;
    return { id: d.id, ...data };
  });
}

export async function getMerchant(id: string): Promise<MerchantConfig | null> {
  const doc = await adminDb.collection(MERCHANTS).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as MerchantConfig;
  return { id: doc.id, ...data };
}

export async function createMerchant(id: string, cfg: MerchantConfig): Promise<MerchantConfig> {
  await adminDb
    .collection(MERCHANTS)
    .doc(id)
    .set(
      {
        ...cfg,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  const saved = await getMerchant(id);
  return saved!;
}

export async function updateMerchant(id: string, partial: Partial<MerchantConfig>): Promise<MerchantConfig | null> {
  await adminDb
    .collection(MERCHANTS)
    .doc(id)
    .set(
      {
        ...partial,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return getMerchant(id);
}

export async function deleteMerchant(id: string): Promise<void> {
  await adminDb.collection(MERCHANTS).doc(id).delete();
}

export async function ensureUniqueId(baseId: string): Promise<string> {
  let id = baseId;
  let i = 1;
  while ((await adminDb.collection(MERCHANTS).doc(id).get()).exists) {
    i += 1;
    id = `${baseId}-${i}`;
  }
  return id;
}

export async function appendOrder(entry: {
  plan: unknown;
  merchant: string;
  requestedBy?: string;
  status?: "PASS" | "FAIL" | "UNKNOWN";
}) {
  const ref = await adminDb.collection(ORDERS).add({
    ...entry,
    status: entry.status || "UNKNOWN",
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listRecentOrders(limit = 10) {
  const snap = await adminDb.collection(ORDERS).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt;
    return {
      id: d.id,
      plan: data.plan,
      merchant: data.merchant,
      requestedBy: data.requestedBy,
      status: data.status || "UNKNOWN",
      createdAt: createdAt ? createdAt.toMillis?.() ?? +createdAt : null,
    };
  });
}