import { adminAuth } from "@/src/lib/firebaseAdmin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function requireUser(req: Request): Promise<DecodedIdToken | null> {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}
