import { BevoMiniApp } from "@bevo/app-sdk";
import type { UserProfile } from "@bevo/app-sdk";

// USDC on Base
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// ---------- Local types (formerly from @0xchat/app-sdk) ----------

export interface GroupMember {
  walletAddress: string;
  displayName: string;
  avatar: string;
  roles: string[];
}

export interface GroupSummary {
  id: string;
  name: string;
  avatar: string;
  memberCount: number;
}

export interface Contact {
  walletAddress: string;
  displayName: string;
  avatar: string;
}

// ---------- Social mock fallbacks ----------

export const MOCK_CONTACTS: Contact[] = [
  { walletAddress: "0xAA1c3F9a2bD4e00112233445566778899aABBccD", displayName: "Alice", avatar: "" },
  { walletAddress: "0xBB2d4F8b3cD5e11223344556677889900BBccDDe", displayName: "Bob", avatar: "" },
  { walletAddress: "0xCC3e5F7c4dE6f2233445566778899AA11CCddEEf", displayName: "Charlie", avatar: "" },
  { walletAddress: "0xDD4f6F6d5fE7a3344556677889900BB22DDeeFFa", displayName: "Dana", avatar: "" },
];

// ---------- Bridge client ----------

class BridgeClient {
  private bevo: BevoMiniApp | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.bevo = BevoMiniApp.isInsideBevo
          ? BevoMiniApp.init()
          : BevoMiniApp.mock();
      } catch {
        this.bevo = null;
      }
    }
  }

  // ---- Profile ----

  async getProfileOrNull(): Promise<UserProfile | null> {
    if (!this.bevo) return null;
    try {
      const profile = this.bevo.user;
      if (!profile.walletAddress) return null;
      return profile;
    } catch {
      return null;
    }
  }

  // ---- Wallet ----

  async getBalance(_token = "USDC"): Promise<string> {
    if (!this.bevo) return "0.00";
    try {
      const balances = await this.bevo.waitForBalances(5000);
      const val = balances.usdc;
      return val != null ? val.toFixed(2) : "0.00";
    } catch {
      return "0.00";
    }
  }

  async sendTransaction(params: { to: string; token: string; amount: string }): Promise<string> {
    if (!this.bevo) throw new Error("Not connected to Bevo.");
    const result = await this.bevo.api.transferTokens({
      toUserWallet: params.to,
      amountEth: parseFloat(params.amount),
      token: params.token as "ETH" | "USDC" | "USDT",
    });
    return result.txHash;
  }

  // ---- Social ----

  async listGroups(): Promise<GroupSummary[]> {
    if (!this.bevo) return [];
    try {
      const groups = await this.bevo.api.getMyGroups();
      return groups.map((g) => ({
        id: String(g.id),
        name: g.name,
        avatar: g.avatar,
        memberCount: g.memberCount,
      }));
    } catch {
      return [];
    }
  }

  async getGroupMembers(_groupId: string): Promise<GroupMember[]> {
    // No group-members endpoint in the Bevo SDK; members are managed via Supabase
    return [];
  }

  async listContacts(): Promise<Contact[]> {
    if (!this.bevo) return MOCK_CONTACTS;
    try {
      const users = await this.bevo.api.searchUsers("");
      if (!users.length) return MOCK_CONTACTS;
      return users.map((u) => ({
        walletAddress: u.walletAddress,
        displayName: u.displayName,
        avatar: u.avatar,
      }));
    } catch {
      return MOCK_CONTACTS;
    }
  }

  async resolveContact(walletAddress: string): Promise<Contact | null> {
    if (!this.bevo) return null;
    try {
      const users = await this.bevo.api.searchUsers(walletAddress);
      const match = users.find(
        (u) => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      if (!match) return null;
      return { walletAddress: match.walletAddress, displayName: match.displayName, avatar: match.avatar };
    } catch {
      return null;
    }
  }

  // shareCardToGroup and openGroup are not available in the Bevo SDK
  async shareCardToGroup(_params: unknown): Promise<void> {}
  openGroup(_groupId: string): void {}
}

export const bridge = new BridgeClient();
