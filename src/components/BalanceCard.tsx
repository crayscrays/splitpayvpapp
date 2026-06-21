import { ArrowRight } from "lucide-react";
import type { GroupMember } from "@/lib/bridge";
import { MemberAvatar } from "./MemberAvatar";
import { formatAddress } from "@/lib/utils";

interface Props {
  member: GroupMember;
  netAmount: number;
  myWallet: string;
  onSettle?: () => void;
  canSettle?: boolean;
}

export function BalanceCard({ member, netAmount, myWallet, onSettle, canSettle }: Props) {
  const isMe = member.walletAddress === myWallet;
  const settled = Math.abs(netAmount) < 0.01;

  return (
    <div className="flex items-center gap-3 px-4 py-3" data-testid={`balance-${member.walletAddress}`}>
      <MemberAvatar name={member.displayName} wallet={member.walletAddress} size="md" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-text text-[14px] truncate">
          {isMe ? "You" : member.displayName}
        </div>
        <div className="text-xs text-text-dim font-mono">
          {formatAddress(member.walletAddress, 4)}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {settled ? (
          <div className="text-sm text-text-muted">settled up</div>
        ) : netAmount > 0 ? (
          <div>
            <div className="text-[10px] text-text-muted leading-tight">gets back</div>
            <div className="font-semibold text-positive text-sm">${netAmount.toFixed(2)}</div>
          </div>
        ) : (
          <div>
            <div className="text-[10px] text-text-muted leading-tight">owes</div>
            <div className="font-semibold text-negative text-sm">${(-netAmount).toFixed(2)}</div>
          </div>
        )}
        {canSettle && onSettle && (
          <button
            onClick={onSettle}
            className="btn btn-primary text-xs px-3 py-1 mt-1.5"
            data-testid={`button-settle-${member.walletAddress}`}
          >
            Pay <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
