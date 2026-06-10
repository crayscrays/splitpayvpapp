export interface BevoContext {
  authToken: string;
  apiBase: string;
  principalId: string;
  walletAddress: string;
  displayName: string;
  username: string;
  avatar: string;
  balances: {
    eth: number | null;
    usdc: number | null;
    usdt: number | null;
  };
  agentWalletAddress: string | null;
  agentPrincipalId: string | null;
}

export interface UserProfile {
  principalId: string;
  walletAddress: string;
  displayName: string;
  username: string;
  avatar: string;
}

export interface WalletBalances {
  eth: number | null;
  usdc: number | null;
  usdt: number | null;
}

export interface AgentInfo {
  walletAddress: string;
  principalId: string;
}

export interface BevoConversation {
  id: string;
  peerPrincipalId: string;
  peerDisplayName: string;
  peerUsername: string;
  peerAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface BevoMessage {
  id: number | string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface BevoGroup {
  id: number;
  name: string;
  handle: string;
  avatar: string;
  memberCount: number;
  description: string;
}

export interface BevoApp {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  installCount: number;
  isVerified: boolean;
  iconUrl: string | null;
  miniappEnabled: boolean;
  entryUrl: string | null;
  permissions: string[];
}

export type BevoPermission =
  | "wallet.read"
  | "wallet.send"
  | "wallet.sign"
  | "user.read"
  | "contacts.read"
  | "groups.read"
  | "chat.write"
  | "bots.manage";

declare global {
  interface Window {
    BevoContext?: BevoContext;
  }
  interface WindowEventMap {
    "bevo:context-updated": CustomEvent<BevoContext>;
  }
}
