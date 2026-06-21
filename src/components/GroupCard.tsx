import { Link } from "react-router-dom";
import type { GroupData } from "@/lib/splitpay-context";

interface Props {
  group: GroupData;
  myWallet: string;
  netBalance: number;
}

const GROUP_COLORS = [
  "#5BC5A7", "#3D8BCD", "#9B59B6", "#E67E22",
  "#E74C3C", "#E91E63", "#2ECC71", "#795548",
  "#00BCD4", "#FF9800",
];

function groupColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}

export function GroupCard({ group, netBalance }: Props) {
  const color = groupColor(group.id);
  const initial = group.name.trim().charAt(0).toUpperCase() || "G";
  const settled = Math.abs(netBalance) < 0.01;

  return (
    <Link
      to={`/group/${group.id}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 active:bg-surface-2 transition-colors"
      data-testid={`link-group-${group.id}`}
    >
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-text text-[15px] truncate">{group.name}</div>
        <div className="text-xs text-text-muted mt-0.5">
          {group.members.length} member{group.members.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        {settled ? (
          <div className="text-xs text-text-muted">settled up</div>
        ) : netBalance > 0 ? (
          <>
            <div className="text-[10px] text-text-muted leading-tight">you are owed</div>
            <div className="font-semibold text-positive text-sm">${netBalance.toFixed(2)}</div>
          </>
        ) : (
          <>
            <div className="text-[10px] text-text-muted leading-tight">you owe</div>
            <div className="font-semibold text-negative text-sm">${(-netBalance).toFixed(2)}</div>
          </>
        )}
      </div>
    </Link>
  );
}
