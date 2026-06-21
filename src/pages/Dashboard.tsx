import { useMemo, useState } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";
import { useSplitPay } from "@/lib/splitpay-context";
import { GroupCard } from "@/components/GroupCard";
import { GroupSheet } from "@/components/GroupSheet";
import { MemberAvatar } from "@/components/MemberAvatar";
import { computeNetBalances, formatCurrency, formatAddress } from "@/lib/utils";

export function Dashboard() {
  const sp = useSplitPay();
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await sp.refreshGroups();
    setRefreshing(false);
  };

  const myWallet = sp.profile?.walletAddress ?? "";

  const groupsWithBal = useMemo(() => {
    return sp.groups.map((g) => {
      const bal = computeNetBalances({ expenses: g.expenses });
      return { group: g, netBalance: bal[myWallet] ?? 0 };
    });
  }, [sp.groups, myWallet]);

  const netTotal = sp.totalOwed - sp.totalOwing;

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-bg">
      {/* Balance summary */}
      <div className="bg-surface border-b border-border px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <MemberAvatar
              name={sp.profile?.displayName ?? "Me"}
              wallet={myWallet}
              src={sp.profile?.avatar}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text leading-tight" data-testid="text-profile-name">
                {sp.profile?.displayName ?? "Hi there"}
              </h2>
              {myWallet && (
                <p className="text-xs text-text-muted font-mono truncate">{formatAddress(myWallet, 6)}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-ghost p-2"
            aria-label="Refresh groups"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {Math.abs(netTotal) < 0.01 ? (
          <p className="text-sm text-text-muted">You are all settled up!</p>
        ) : netTotal > 0 ? (
          <p className="text-sm text-text-muted">
            Overall, you are owed{" "}
            <span className="font-semibold text-positive">{formatCurrency(netTotal)}</span>
          </p>
        ) : (
          <p className="text-sm text-text-muted">
            Overall, you owe{" "}
            <span className="font-semibold text-negative">{formatCurrency(-netTotal)}</span>
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-positive/10 rounded-xl px-3 py-2.5">
            <div className="text-[11px] text-text-muted">you are owed</div>
            <div className="font-bold text-positive text-base mt-0.5" data-testid="text-total-owed">
              {formatCurrency(sp.totalOwed)}
            </div>
          </div>
          <div className="bg-negative/10 rounded-xl px-3 py-2.5">
            <div className="text-[11px] text-text-muted">you owe</div>
            <div className="font-bold text-negative text-base mt-0.5" data-testid="text-total-owing">
              {formatCurrency(sp.totalOwing)}
            </div>
          </div>
        </div>
      </div>

      {/* Groups list */}
      <div className="mt-3 bg-surface">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold text-text">Groups</h3>
          <button
            onClick={() => setShowPicker(true)}
            className="h-7 w-7 rounded-full bg-accent flex items-center justify-center"
            data-testid="button-add-group"
            aria-label="Add group"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>

        {groupsWithBal.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-accent/10 items-center justify-center mb-3">
              <Users size={24} className="text-accent" />
            </div>
            <div className="text-sm font-medium text-text">No groups yet</div>
            <div className="text-xs text-text-muted mt-1 mb-4">
              Create a group and start splitting expenses
            </div>
            <button
              onClick={() => setShowPicker(true)}
              className="btn btn-primary px-5 py-2.5 text-sm font-semibold"
              data-testid="button-create-first-group"
            >
              <Plus size={14} /> Start a group
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groupsWithBal.map(({ group, netBalance }) => (
              <GroupCard
                key={group.id}
                group={group}
                myWallet={myWallet}
                netBalance={netBalance}
              />
            ))}
          </div>
        )}
      </div>

      {showPicker && <GroupSheet onClose={() => setShowPicker(false)} />}
    </div>
  );
}
