import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Loader2 } from "lucide-react";
import { useSplitPay } from "@/lib/splitpay-context";
import { Header } from "@/components/Header";
import { MemberAvatar } from "@/components/MemberAvatar";
import { formatCurrency } from "@/lib/utils";

interface PaymentState {
  status: "idle" | "pending" | "success" | "error";
  txHash?: string;
  error?: string;
}

export function SettleUp() {
  const { groupId = "" } = useParams();
  const sp = useSplitPay();
  const nav = useNavigate();
  const group = sp.getGroup(groupId);
  const myWallet = sp.profile?.walletAddress ?? "";
  const [payments, setPayments] = useState<Record<string, PaymentState>>({});

  const debts = useMemo(
    () => (group ? sp.computeGroupDebts(group.id) : []),
    [group, sp]
  );

  // Only show debts where current user is the one paying
  const myDebts = debts.filter((d) => d.from === myWallet);
  const otherDebts = debts.filter((d) => d.from !== myWallet);

  if (!group) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Settle up" back />
        <div className="p-8 text-center text-text-muted">Group not found.</div>
      </div>
    );
  }

  const getMember = (wallet: string) =>
    group.members.find((m) => m.walletAddress === wallet);

  const settleDebt = async (debt: { from: string; to: string; amount: number }) => {
    const key = `${debt.from}->${debt.to}`;
    setPayments((p) => ({ ...p, [key]: { status: "pending" } }));
    try {
      // Find first unsettled split from `from` to payer (`to`) in any expense, and settle
      // proportionally. For simplicity, we settle ALL unsettled splits owed by `from` to
      // expenses paid by `to` until we've covered `debt.amount`.
      let remaining = debt.amount;
      let lastHash = "";
      for (const exp of group.expenses) {
        if (exp.paidBy !== debt.to) continue;
        for (const s of exp.splits) {
          if (s.wallet !== debt.from || s.settled) continue;
          if (remaining < 0.01) break;
          lastHash = await sp.settleSplit({
            groupId: group.id,
            expenseId: exp.id,
            wallet: s.wallet,
            amount: s.amount,
            toWallet: debt.to,
          });
          remaining -= s.amount;
        }
        if (remaining < 0.01) break;
      }
      setPayments((p) => ({
        ...p,
        [key]: { status: "success", txHash: lastHash },
      }));
    } catch (err: any) {
      const raw = (err?.message ?? err?.details ?? "").toLowerCase();
      const isNoGas =
        raw.includes("gas required exceeds allowance") ||
        raw.includes("insufficient funds") ||
        raw.includes("exceeds allowance (0)");
      const isNetworkError =
        raw.includes("load failed") ||
        raw.includes("failed to fetch") ||
        raw.includes("networkerror") ||
        raw.includes("network request failed");
      setPayments((p) => ({
        ...p,
        [key]: {
          status: "error",
          error: isNoGas
            ? "Your wallet has no ETH for gas. Fund it with Base ETH, then retry."
            : isNetworkError
            ? "Could not reach the Bevo wallet API. Check your connection and try again."
            : err?.shortMessage ?? err?.message ?? "Transaction failed",
        },
      }));
    }
  };

  const settleAll = async () => {
    for (const d of myDebts) {
      const key = `${d.from}->${d.to}`;
      if (payments[key]?.status === "success") continue;
      await settleDebt(d);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Settle up" subtitle={group.name} back={`/group/${group.id}`} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {debts.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="inline-flex h-12 w-12 rounded-full bg-positive/10 border border-positive/30 items-center justify-center mb-3">
              <Check size={20} className="text-positive" />
            </div>
            <div className="text-sm font-semibold text-text">All settled!</div>
            <div className="text-xs text-text-muted mt-1">
              Nobody owes anyone in this group.
            </div>
            <button
              onClick={() => nav(`/group/${group.id}`)}
              className="btn btn-secondary mt-4 px-4 py-2 text-sm"
            >
              Back to group
            </button>
          </div>
        ) : (
          <>
            {myDebts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="label">Your payments</h3>
                  {myDebts.length > 1 && (
                    <button
                      onClick={settleAll}
                      className="btn btn-ghost text-xs px-2 py-1"
                      data-testid="button-pay-all"
                    >
                      Pay all
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {myDebts.map((d) => {
                    const key = `${d.from}->${d.to}`;
                    const state = payments[key] ?? { status: "idle" as const };
                    const to = getMember(d.to);
                    return (
                      <div
                        key={key}
                        className="card p-4"
                        data-testid={`debt-${d.to}`}
                      >
                        <div className="flex items-center gap-3">
                          <MemberAvatar name="You" wallet={d.from} size="md" />
                          <ArrowRight size={14} className="text-text-dim" />
                          <MemberAvatar
                            name={to?.displayName ?? "Unknown"}
                            wallet={d.to}
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              To {to?.displayName ?? "Unknown"}
                            </div>
                            <div className="text-xs text-text-muted">USDC on Base</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {formatCurrency(d.amount)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          {state.status === "idle" && (
                            <button
                              onClick={() => settleDebt(d)}
                              className="btn btn-primary w-full py-2 text-sm"
                              data-testid={`pay-${d.to}`}
                            >
                              Pay {formatCurrency(d.amount)} USDC
                            </button>
                          )}
                          {state.status === "pending" && (
                            <button
                              disabled
                              className="btn btn-primary w-full py-2 text-sm"
                            >
                              <Loader2 size={14} className="animate-spin" /> Waiting
                              for approval…
                            </button>
                          )}
                          {state.status === "success" && (
                            <div className="flex items-center justify-between text-sm bg-positive/10 border border-positive/30 rounded-lg px-3 py-2">
                              <span className="text-positive inline-flex items-center gap-1.5">
                                <Check size={14} /> Paid
                              </span>
                              {state.txHash && (
                                <a
                                  href={`https://basescan.org/tx/${state.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-text-muted hover:text-text inline-flex items-center gap-1"
                                >
                                  View on BaseScan <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          )}
                          {state.status === "error" && (
                            <div className="space-y-2">
                              <div className="text-xs text-negative bg-negative/10 border border-negative/30 rounded-lg px-3 py-2">
                                {state.error}
                              </div>
                              <button
                                onClick={() => settleDebt(d)}
                                className="btn btn-secondary w-full py-2 text-sm"
                              >
                                Retry
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {otherDebts.length > 0 && (
              <section>
                <h3 className="label mb-2">Others in this group</h3>
                <div className="space-y-2">
                  {otherDebts.map((d) => {
                    const from = getMember(d.from);
                    const to = getMember(d.to);
                    return (
                      <div
                        key={`${d.from}->${d.to}`}
                        className="card p-3 flex items-center gap-3"
                      >
                        <MemberAvatar
                          name={from?.displayName ?? "?"}
                          wallet={d.from}
                          size="sm"
                        />
                        <ArrowRight size={12} className="text-text-dim" />
                        <MemberAvatar
                          name={to?.displayName ?? "?"}
                          wallet={d.to}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1 text-sm text-text-muted truncate">
                          <span className="text-text font-medium">
                            {from?.displayName}
                          </span>{" "}
                          owes{" "}
                          <span className="text-text font-medium">
                            {to?.displayName}
                          </span>
                        </div>
                        <div className="font-medium text-sm">
                          {formatCurrency(d.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
