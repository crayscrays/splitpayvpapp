import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean | string;
  right?: ReactNode;
  className?: string;
}

export function Header({ title, subtitle, back, right, className }: Props) {
  const nav = useNavigate();
  return (
    <header
      className={cn(
        "sticky top-0 z-10 bg-surface border-b border-border px-4 py-3.5 flex items-center gap-3",
        className
      )}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      {back && (
        <button
          onClick={() => (typeof back === "string" ? nav(back) : nav(-1))}
          className="btn btn-ghost h-9 w-9 -ml-2"
          aria-label="Back"
          data-testid="button-back"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold leading-tight truncate text-text" data-testid="text-header-title">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-text-muted truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
}
