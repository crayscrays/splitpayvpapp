interface BevoContext {
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
interface UserProfile {
    principalId: string;
    walletAddress: string;
    displayName: string;
    username: string;
    avatar: string;
}
interface WalletBalances {
    eth: number | null;
    usdc: number | null;
    usdt: number | null;
}
interface AgentInfo {
    walletAddress: string;
    principalId: string;
}
interface BevoConversation {
    id: string;
    peerPrincipalId: string;
    peerDisplayName: string;
    peerUsername: string;
    peerAvatar: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
}
interface BevoMessage {
    id: number | string;
    senderId: string;
    content: string;
    createdAt: string;
}
interface BevoGroup {
    id: number;
    name: string;
    handle: string;
    avatar: string;
    memberCount: number;
    description: string;
}
interface BevoApp {
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
type BevoPermission = "wallet.read" | "wallet.send" | "wallet.sign" | "user.read" | "contacts.read" | "groups.read" | "chat.write" | "bots.manage";
declare global {
    interface Window {
        BevoContext?: BevoContext;
    }
    interface WindowEventMap {
        "bevo:context-updated": CustomEvent<BevoContext>;
    }
}

declare class BevoApiClient {
    private context;
    constructor(context: BevoContext);
    _update(context: BevoContext): void;
    private get headers();
    private get base();
    request<T = unknown>(path: string, init?: RequestInit): Promise<T>;
    getMyProfile(): Promise<UserProfile>;
    updateProfile(data: Partial<Pick<UserProfile, "displayName" | "username">> & {
        bio?: string;
    }): Promise<void>;
    searchUsers(query: string): Promise<UserProfile[]>;
    getConversations(): Promise<BevoConversation[]>;
    createOrGetConversation(peerPrincipalId: string): Promise<string>;
    getMessages(conversationId: string, after?: string): Promise<BevoMessage[]>;
    sendMessage(conversationId: string, content: string): Promise<{
        message: BevoMessage;
    }>;
    markRead(conversationId: string): Promise<void>;
    getMyGroups(): Promise<BevoGroup[]>;
    searchGroups(query: string): Promise<BevoGroup[]>;
    getApps(params?: {
        search?: string;
        category?: string;
    }): Promise<BevoApp[]>;
    getApp(slug: string): Promise<{
        app: BevoApp;
        installed: boolean;
        grantedPermissions: string[];
    }>;
    transferTokens(params: {
        toUserHandle?: string;
        toUserWallet?: string;
        amountEth: number;
        token?: "ETH" | "USDC" | "USDT";
        fromWallet?: "agent" | "personal";
    }): Promise<{
        txHash: string;
        fromWallet: string;
        toWallet: string;
        amount: number;
        token: string;
    }>;
}
declare class BevoMiniApp {
    private _context;
    readonly api: BevoApiClient;
    private constructor();
    static init(): BevoMiniApp;
    static mock(overrides?: Partial<BevoContext>): BevoMiniApp;
    get context(): BevoContext;
    get user(): UserProfile;
    get balances(): WalletBalances;
    get agent(): AgentInfo | null;
    static get isInsideBevo(): boolean;
    onUpdate(callback: (context: BevoContext) => void): () => void;
    waitForBalances(timeoutMs?: number): Promise<WalletBalances>;
    waitForAgent(timeoutMs?: number): Promise<AgentInfo>;
}

export { type AgentInfo, BevoApiClient, type BevoApp, type BevoContext, type BevoConversation, type BevoGroup, type BevoMessage, BevoMiniApp, type BevoPermission, type UserProfile, type WalletBalances };
