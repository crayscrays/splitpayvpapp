import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, Plus, X } from "lucide-react";
import { useSplitPay } from "@/lib/splitpay-context";
import { Header } from "@/components/Header";
import { GroupCard } from "@/components/GroupCard";
import { GroupSheet } from "@/components/GroupSheet";
import { computeNetBalances } from "@/lib/utils";

function JoinByCodeSheet({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (clean.length !== 6) return;
    nav(`/join/${clean}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-[480px] bg-surface border-t border-border rounded-t-2xl fade-in">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Join by code</h3>
          <button onClick={onClose} className="btn btn-ghost p-1.5">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-muted">
            Enter the 6-letter invite code shared by the group creator.
          </p>
          <input
            ref={inputRef}
            autoFocus
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))
            }
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="ABCXYZ"
            className="input w-full text-center text-2xl font-mono tracking-[0.35em] py-3 uppercase"
            maxLength={6}
          />
          <button
            onClick={handleSubmit}
            disabled={code.replace(/[^A-Z]/g, "").length !== 6}
            className="btn btn-primary w-full py-3 text-sm font-semibold"
          >
            Join group
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupsPage() {
  const sp = useSplitPay();
  const [showSheet, setShowSheet] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const myWallet = sp.profile?.walletAddress ?? "";

  const groupsWithBal = useMemo(
    () =>
      sp.groups.map((g) => ({
        group: g,
        netBalance: computeNetBalances({ expenses: g.expenses })[myWallet] ?? 0,
      })),
    [sp.groups, myWallet]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg">
      <Header
        title="Groups"
        subtitle={`${sp.groups.length} group${sp.groups.length === 1 ? "" : "s"}`}
        right={
          <button
            onClick={() => setShowSheet(true)}
            className="h-8 w-8 rounded-full bg-accent flex items-center justify-center"
            aria-label="Add group"
            data-testid="button-add-group-page"
          >
            <Plus size={16} className="text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {groupsWithBal.length > 0 && (
          <div className="mt-3 bg-surface divide-y divide-border">
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

        {sp.groups.length === 0 && (
          <div className="mt-3 bg-surface px-4 py-10 text-center">
            <div className="text-sm text-text-muted mb-4">No groups yet.</div>
            <button
              onClick={() => setShowSheet(true)}
              className="btn btn-primary px-4 py-2 text-sm"
            >
              <Plus size={14} /> Create or link a group
            </button>
          </div>
        )}

        <div className="mt-3 bg-surface divide-y divide-border">
          <button
            onClick={() => setShowSheet(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors text-left"
            data-testid="button-add-group-row"
          >
            <div className="h-11 w-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <Plus size={18} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-accent text-[15px]">Add group</div>
              <div className="text-xs text-text-muted">Create new or link from 0xChat</div>
            </div>
          </button>

          <button
            onClick={() => setShowJoinCode(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors text-left"
            data-testid="button-join-by-code"
          >
            <div className="h-11 w-11 rounded-xl bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
              <Hash size={18} className="text-text-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-text text-[15px]">Join by code</div>
              <div className="text-xs text-text-muted">Enter a 6-letter invite code</div>
            </div>
          </button>
        </div>
      </div>

      {showSheet && <GroupSheet onClose={() => setShowSheet(false)} />}
      {showJoinCode && <JoinByCodeSheet onClose={() => setShowJoinCode(false)} />}
    </div>
  );
}
