import { Link } from "react-router-dom";
import type { Expense, GroupData } from "@/lib/splitpay-context";
import { Receipt } from "lucide-react";

interface Props {
  expense: Expense;
  group: GroupData;
  myWallet: string;
}

function expenseDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: d.getDate(),
  };
}

export function ExpenseCard({ expense, group, myWallet }: Props) {
  const payer = group.members.find((m) => m.walletAddress === expense.paidBy);
  const mySplit = expense.splits.find((s) => s.wallet === myWallet);
  const paidByMe = expense.paidBy === myWallet;
  const { month, day } = expenseDate(expense.createdAt);

  let myImpact = 0;
  if (paidByMe) {
    myImpact = expense.splits
      .filter((s) => s.wallet !== myWallet && !s.settled)
      .reduce((sum, s) => sum + s.amount, 0);
  } else if (mySplit && !mySplit.settled) {
    myImpact = -mySplit.amount;
  }

  const allSettled = expense.splits.every((s) => s.settled || s.wallet === expense.paidBy);

  return (
    <Link
      to={`/group/${expense.groupId}/expense/${expense.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
      data-testid={`link-expense-${expense.id}`}
    >
      {/* Date */}
      <div className="w-7 text-center flex-shrink-0">
        <div className="text-[9px] font-medium text-text-dim uppercase tracking-wide">{month}</div>
        <div className="text-sm font-semibold text-text-muted leading-tight">{day}</div>
      </div>

      {/* Category icon */}
      <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
        <Receipt size={17} className="text-orange-500" />
      </div>

      {/* Description + payer */}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-text text-[14px] truncate">{expense.description}</div>
        <div className="text-xs text-text-muted mt-0.5">
          <span>{paidByMe ? "You" : (payer?.displayName ?? "Someone")} paid</span>
          <span className="mx-1">·</span>
          <span>${expense.amount.toFixed(2)}</span>
        </div>
      </div>

      {/* My financial impact */}
      <div className="text-right flex-shrink-0 min-w-[68px]">
        {Math.abs(myImpact) > 0.009 ? (
          <>
            <div className={`text-[10px] leading-tight ${myImpact > 0 ? "text-positive" : "text-negative"}`}>
              {myImpact > 0 ? "you lent" : "you owe"}
            </div>
            <div className={`font-semibold text-sm ${myImpact > 0 ? "text-positive" : "text-negative"}`}>
              ${Math.abs(myImpact).toFixed(2)}
            </div>
          </>
        ) : allSettled ? (
          <div className="text-[11px] text-text-muted">settled</div>
        ) : (
          <div className="text-[11px] text-text-muted">not involved</div>
        )}
      </div>
    </Link>
  );
}
