import { useEffect, useState } from "react";
import { BevoMiniApp } from "@bevo/app-sdk";
import { USDC_BASE_SEPOLIA } from "@/lib/bridge";

interface Step {
  label: string;
  status: "pending" | "ok" | "error";
  value?: string;
  error?: string;
  ms?: number;
}

export function DebugPage() {
  const [steps, setSteps] = useState<Step[]>([
    { label: "BevoMiniApp.isInsideBevo", status: "pending" },
    { label: "BevoMiniApp.init() / mock()", status: "pending" },
    { label: "bevo.user (profile)", status: "pending" },
    { label: "bevo.waitForBalances()", status: "pending" },
  ]);

  const patch = (index: number, update: Partial<Step>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));

  useEffect(() => {
    (async () => {
      // Step 0: isInsideBevo detection
      const isInside = BevoMiniApp.isInsideBevo;
      patch(0, { status: "ok", value: String(isInside) });

      // Step 1: init or mock
      let bevo: BevoMiniApp | null = null;
      const t1 = Date.now();
      try {
        bevo = isInside ? BevoMiniApp.init() : BevoMiniApp.mock();
        patch(1, {
          status: "ok",
          value: isInside ? "init() — inside Bevo" : "mock() — dev mode",
          ms: Date.now() - t1,
        });
      } catch (e: any) {
        patch(1, { status: "error", error: e?.message ?? String(e), ms: Date.now() - t1 });
        return;
      }

      // Step 2: user profile (synchronous)
      const t2 = Date.now();
      try {
        const profile = bevo.user;
        patch(2, {
          status: "ok",
          value: JSON.stringify(profile, null, 2),
          ms: Date.now() - t2,
        });
      } catch (e: any) {
        patch(2, { status: "error", error: e?.message ?? String(e), ms: Date.now() - t2 });
      }

      // Step 3: wait for balances
      const t3 = Date.now();
      try {
        const balances = await bevo.waitForBalances(5000);
        patch(3, {
          status: "ok",
          value: `USDC: ${balances.usdc ?? "null"} · ETH: ${balances.eth ?? "null"} · USDT: ${balances.usdt ?? "null"}`,
          ms: Date.now() - t3,
        });
      } catch (e: any) {
        patch(3, { status: "error", error: e?.message ?? String(e), ms: Date.now() - t3 });
      }
    })();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
      <h1 className="text-base font-bold">Bridge Debug</h1>
      <p className="text-xs text-text-muted">
        SDK: <code className="font-mono">@bevo/app-sdk</code> · BevoMiniApp
      </p>
      <p className="text-xs text-text-dim font-mono break-all">
        USDC: {USDC_BASE_SEPOLIA}
      </p>

      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface p-3 space-y-1.5"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">
              {step.status === "pending" ? "⏳" : step.status === "ok" ? "✅" : "❌"}
            </span>
            <span className="text-xs font-medium font-mono">{step.label}</span>
            {step.ms !== undefined && (
              <span className="ml-auto text-xs text-text-dim">{step.ms}ms</span>
            )}
          </div>

          {step.value && (
            <pre className="text-xs text-positive bg-positive/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
              {step.value}
            </pre>
          )}
          {step.error && (
            <pre className="text-xs text-negative bg-negative/10 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
              {step.error}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
