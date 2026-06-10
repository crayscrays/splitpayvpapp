import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Hash, Plus } from "lucide-react";
import type { GroupMember, GroupSummary } from "@/lib/bridge";
import { useSplitPay } from "@/lib/splitpay-context";
import { MemberAvatar } from "./MemberAvatar";

interface GroupSheetProps {
  onClose: () => void;
}

export function GroupSheet({ onClose }: GroupSheetProps) {
  const [view, setView] = useState<"list" | "create" | "join">("list");

  if (view === "create") {
    return <CreateView onClose={onClose} onBack={() => setView("list")} />;
  }
  if (view === "join") {
    return <JoinView onClose={onClose} onBack={() => setView("list")} />;
  }
  return <ListView onClose={onClose} onCreateNew={() => setView("create")} onJoinByCode={() => setView("join")} />;
}

function ListView({
  onClose,
  onCreateNew,
  onJoinByCode,
}: {
  onClose: () => void;
  onCreateNew: () => void;
  onJoinByCode: () => void;
}) {
  const sp = useSplitPay();
  const [adding, setAdding] = useState<string | null>(null);

  const add = async (g: GroupSummary) => {
    setAdding(g.id);
    try {
      await sp.addGroup(g);
      onClose();
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative w-full max-w-[480px] bg-surface border-t border-border rounded-t-2xl max-h-[70vh] flex flex-col fade-in"
        data-testid="sheet-add-group"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Add group</h3>
          <button onClick={onClose} className="btn btn-ghost text-sm px-3 py-1">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Create new */}
          <button
            onClick={onCreateNew}
            className="w-full card p-3 flex items-center gap-3 hover:border-accent/50 text-left border border-dashed"
            data-testid="button-create-group"
          >
            <div className="h-9 w-9 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <Plus size={16} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-accent">Create new group</div>
              <div className="text-xs text-text-muted">Set a name and invite members</div>
            </div>
          </button>

          {/* Join by code */}
          <button
            onClick={onJoinByCode}
            className="w-full card p-3 flex items-center gap-3 hover:border-border-strong text-left border border-dashed"
            data-testid="button-join-by-code"
          >
            <div className="h-9 w-9 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
              <Hash size={16} className="text-text-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text-muted">Join by code</div>
              <div className="text-xs text-text-dim">Enter a 6-letter invite code</div>
            </div>
          </button>

          {/* Link from 0xChat */}
          {sp.availableGroups.length > 0 && (
            <>
              <div className="label pt-1">From 0xChat</div>
              {sp.availableGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => add(g)}
                  disabled={adding !== null}
                  className="w-full card p-3 flex items-center gap-3 hover:border-border-strong text-left"
                  data-testid={`add-available-${g.id}`}
                >
                  <MemberAvatar name={g.name} wallet={g.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{g.name}</div>
                    <div className="text-xs text-text-muted">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  {adding === g.id ? (
                    <span className="text-xs text-text-muted">Adding…</span>
                  ) : (
                    <Plus size={16} className="text-text-muted" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function JoinView({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = () => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (clean.length !== 6) return;
    nav(`/join/${clean}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-[480px] bg-surface border-t border-border rounded-t-2xl fade-in">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <button onClick={onBack} className="btn btn-ghost p-1.5 -ml-1" aria-label="Back">
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-semibold flex-1">Join by code</h3>
          <button onClick={onClose} className="btn btn-ghost text-sm px-3 py-1">
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-muted">
            Enter the 6-letter invite code shared by the group creator.
          </p>
          <input
            ref={inputRef}
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

function CreateView({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const sp = useSplitPay();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const myWallet = sp.profile?.walletAddress ?? "";
    const group = await sp.createGroup(name.trim(), [
      {
        walletAddress: myWallet,
        displayName: sp.profile?.displayName ?? "You",
        avatar: sp.profile?.avatar ?? "",
        roles: ["admin"],
      },
    ]);
    onClose();
    nav(`/group/${group.id}`, { state: { showInvite: true } });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-[480px] bg-surface border-t border-border rounded-t-2xl fade-in">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <button onClick={onBack} className="btn btn-ghost p-1.5 -ml-1" aria-label="Back">
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-semibold flex-1">New group</h3>
          <button onClick={onClose} className="btn btn-ghost text-sm px-3 py-1">
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="label block mb-1.5">Group name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Tokyo Trip"
              className="input"
            />
            <p className="text-xs text-text-dim mt-2">
              You'll get an invite link to share after creating the group.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="btn btn-primary w-full py-3 text-sm font-semibold"
            data-testid="button-create-group-submit"
          >
            Create group
          </button>
        </div>
      </div>
    </div>
  );
}
