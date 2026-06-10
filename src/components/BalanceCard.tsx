import { ArrowRight } from "lucide-react";
import type { GroupMember } from "@/lib/bridge";
import { MemberAvatar } from "./MemberAvatar";
import { formatAddress, formatCurrency } from "@/lib/utils";

interface Props {
  member: GroupMember;
  netAmount: number; // positive = owed to them
  myWallet: string;
  onSettle?: () => void;
  canSettle?: boolean;
}

export function BalanceCard({ member, netAmount, myWallet, onSettle, canSettle }: Props) {
  const isMe = member.walletAddress === myWallet;
  const settled = Math.abs(netAmount) < 0.01;

  return (
    <div className="card p-4 flex items-center gap-3" data-testid={`balance-${member.walletAddress}`}>
      <MemberAvatar name={member.displayName} wallet={member.walletAddress} size="md" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-text truncate">
          {isMe ? "You" : member.displayName}
        </div>
        <div className="text-xs text-text-dim font-mono">
          {formatAddress(member.walletAddress, 4)}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {settled ? (
          <div className="text-sm text-text-muted">Settled</div>
        ) : netAmount > 0 ? (
          <div>
            <div className="text-xs text-text-muted">gets back</div>
            <div className="font-semibold text-positive">{formatCurrency(netAmount)}</div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-text-muted">owes</div>
            <div className="font-semibold text-negative">{formatCurrency(-netAmount)}</div>
          </div>
        )}
        {canSettle && onSettle && (
          <button
            onClick={onSettle}
            className="btn btn-primary text-xs px-3 py-1.5 mt-2"
            data-testid={`button-settle-${member.walletAddress}`}
          >
            Pay <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
