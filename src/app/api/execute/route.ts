import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { requireUser } from "@/src/lib/authGuard";
import { getMerchant } from "@/src/lib/merchantsStore";

function mapConfig(key: string) {
  const root = process.cwd();
  if (key === "a") return path.join(root, "merchant-configs", "asaply-demo.json");
  if (key === "b") return path.join(root, "merchant-configs", "asaply-demo-b.json");
  return null;
}

export async function POST(req: Request) {
  const decoded = await requireUser(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { plan, configKey, merchantId } = await req.json();
    if (!plan) {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    let configPath: string | null = null;
    if (merchantId) {
      const cfg = await getMerchant(String(merchantId));
      if (!cfg) {
        return NextResponse.json({ error: "Unknown merchantId" }, { status: 400 });
      }
      const tmpPath = path.join(process.cwd(), ".run-config.json");
      fs.writeFileSync(tmpPath, JSON.stringify(cfg, null, 2));
      configPath = tmpPath;
    } else {
      configPath = mapConfig(String(configKey ?? "a"));
      if (!configPath) {
        return NextResponse.json({ error: "Unknown configKey" }, { status: 400 });
      }
    }

    const planPath = path.join(process.cwd(), ".last-plan.json");
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

    const args = ["run", "exec:plan", "--", "--plan", planPath, "--config", configPath];
    const child = spawn("npm", args, { shell: true });

    let logs = "";
    child.stdout.on("data", (chunk) => {
      logs += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk.toString();
    });

    const exitCode: number = await new Promise((resolve) => {
      child.on("close", (code) => resolve(code ?? 1));
    });
    const ok = /\[verify\]\s+RESULT:\s+PASS/.test(logs);

    return NextResponse.json({ ok, exitCode, logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}
