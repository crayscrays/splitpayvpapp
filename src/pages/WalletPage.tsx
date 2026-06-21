import { Copy, ExternalLink, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { useSplitPay } from "@/lib/splitpay-context";
import { Header } from "@/components/Header";
import { MemberAvatar } from "@/components/MemberAvatar";
import { formatAddress, formatUsdc } from "@/lib/utils";

export function WalletPage() {
  const sp = useSplitPay();
  const [copied, setCopied] = useState(false);
  const addr = sp.profile?.walletAddress ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Wallet" subtitle="USDC on Base Sepolia" />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Balance card */}
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <MemberAvatar
              name={sp.profile?.displayName ?? "You"}
              wallet={addr}
              src={sp.profile?.avatar}
              size="lg"
            />
            <div className="min-w-0">
              <div className="font-semibold">{sp.profile?.displayName}</div>
              <button
                onClick={copy}
                className="text-xs text-text-muted font-mono inline-flex items-center gap-1 hover:text-text"
                data-testid="button-copy-address"
              >
                {formatAddress(addr, 6)}
                <Copy size={10} />
                {copied && <span className="text-accent ml-1">copied</span>}
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <div className="text-3xl font-semibold tracking-tight">
              {formatUsdc(Number(sp.balance) || 0)}
            </div>
          </div>
          <div className="text-xs text-text-muted mt-1 inline-flex items-center gap-1">
            <WalletIcon size={11} /> Base Sepolia · USDC
          </div>
        </div>

        {/* Connection info */}
        <div className="card p-4">
          <div className="text-sm font-medium text-text mb-1">
            {sp.mode === "live" ? "0xChat wallet" : "Connected wallet"}
          </div>
          <div className="text-xs text-text-muted leading-relaxed">
            {sp.mode === "live"
              ? "Using your 0xChat embedded wallet. Payments are approved through 0xChat — SplitPay never sees your keys."
              : "Using an injected wallet (MetaMask or similar). Transactions require your approval in the wallet extension."}
          </div>
        </div>

        <a
          href={`https://sepolia.basescan.org/address/${addr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary w-full py-2.5 text-sm"
        >
          View on BaseScan <ExternalLink size={13} />
        </a>


      </div>
    </div>
  );
}
