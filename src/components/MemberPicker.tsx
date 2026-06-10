import type { GroupMember } from "@/lib/bridge";
import { Check } from "lucide-react";
import { MemberAvatar } from "./MemberAvatar";
import { cn } from "@/lib/utils";

interface Props {
  members: GroupMember[];
  selected: Set<string>;
  onToggle: (wallet: string) => void;
  myWallet: string;
}

export function MemberPicker({ members, selected, onToggle, myWallet }: Props) {
  return (
    <div className="space-y-1.5">
      {members.map((m) => {
        const isSelected = selected.has(m.walletAddress);
        const isMe = m.walletAddress === myWallet;
        return (
          <button
            key={m.walletAddress}
            type="button"
            onClick={() => onToggle(m.walletAddress)}
            className={cn(
              "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left",
              isSelected
                ? "bg-accent/10 border-accent/50"
                : "bg-surface-2 border-border hover:border-border-strong"
            )}
            data-testid={`picker-${m.walletAddress}`}
          >
            <MemberAvatar name={m.displayName} wallet={m.walletAddress} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text text-sm truncate">
                {isMe ? "You" : m.displayName}
              </div>
            </div>
            <div
              className={cn(
                "h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0",
                isSelected ? "bg-accent border-accent text-white" : "border-border-strong"
              )}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
