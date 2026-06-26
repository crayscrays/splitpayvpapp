/**
 * Injected into `window.BevoContext` by the Bevo host app immediately when
 * the mini-app page finishes loading. Balances and agent fields are null on
 * the first injection and populated ~1-2 s later; listen for
 * `bevo:context-updated` to react to the updated values.
 */
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
/** Structured data for messages with contentType "attachment". */
interface AttachmentMessage {
    url: string;
    filename: string;
    /** MIME type, e.g. "image/png" or "application/pdf". */
    contentType?: string;
    /** File size in bytes. */
    size?: number;
    /** Image/video width in pixels. */
    width?: number;
    /** Image/video height in pixels. */
    height?: number;
}
interface BevoGroupMessage {
    id: number;
    groupId: number;
    channelId: number | null;
    senderId: string;
    senderDisplayName?: string;
    senderAvatar?: string | null;
    content: string;
    contentType?: string;
    metadata?: {
        attachment?: AttachmentMessage;
        caption?: string;
        [key: string]: unknown;
    } | null;
    createdAt: string;
}
interface BevoContact {
    id: string;
    ownerId: string;
    peerId: string;
    status: "pending" | "accepted" | "blocked";
    createdAt: string;
    acceptedAt: string | null;
}
interface BevoAgentPermission {
    id: string;
    principalId: string;
    agentId: string;
    scope: "group" | "dm" | "global";
    scopeId: string | null;
    permissions: unknown[];
    constraints: Record<string, unknown>;
    grantedAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
}
type BevoPermission = "wallet.read" | "wallet.send" | "wallet.sign" | "user.read" | "contacts.read" | "groups.read" | "chat.write" | "bots.manage";
interface SignTransactionParams {
    /** Target contract or EOA address (0x…) */
    to: string;
    /** ABI-encoded calldata (0x…) */
    data: string;
    /** Value in wei as hex string, e.g. "0x0" (default: "0x0") */
    value?: string;
    /** EVM chain ID. Defaults to 8453 (Base mainnet). */
    chainId?: number;
    /** Human-readable description shown in the approval sheet. */
    description?: string;
}
interface SendTokensParams {
    /** Bevo @handle of the recipient (without the @). */
    toUserHandle?: string;
    /** Raw 0x… wallet address of the recipient. */
    toWallet?: string;
    /** Amount in human-readable units (e.g. 0.01 for 0.01 ETH). */
    amount: number;
    /** Token symbol. Defaults to "ETH". */
    token?: "ETH" | "USDC" | "USDT";
    /** Human-readable description shown in the send sheet. */
    description?: string;
}
interface MiniAppTxResult {
    txHash: string;
}
declare global {
    interface Window {
        BevoContext?: BevoContext;
        /** Flutter JS channel — injected by the host app. */
        BevoHost?: {
            postMessage(msg: string): void;
        };
        /** Callback map populated by the SDK; resolved by the host app. */
        _bevoResolve?: (id: string, result: {
            success: boolean;
            txHash?: string;
            error?: string;
        }) => void;
    }
    interface WindowEventMap {
        "bevo:context-updated": CustomEvent<BevoContext>;
    }
}

/**
 * Thin fetch wrapper pre-configured with the user's Bevo auth token.
 * Use it to call any Bevo backend endpoint from your mini-app.
 */
declare class BevoApiClient {
    private context;
    constructor(context: BevoContext);
    /** @internal Update context when the host app re-injects with fresh data. */
    _update(context: BevoContext): void;
    private get headers();
    private get base();
    /** Make an authenticated request to the Bevo backend. */
    request<T = unknown>(path: string, init?: RequestInit): Promise<T>;
    /** Fetch the signed-in user's full backend profile. */
    getMyProfile(): Promise<UserProfile>;
    /** Fetch any user's public profile by principalId. */
    getUser(principalId: string): Promise<UserProfile>;
    /** Update the signed-in user's profile. */
    updateProfile(data: Partial<Pick<UserProfile, "displayName" | "username">> & {
        bio?: string;
        searchableByHandle?: boolean;
        searchableByWallet?: boolean;
        searchableByEmail?: boolean;
    }): Promise<void>;
    /** Search users by display name, username, email, or wallet. */
    searchUsers(query: string): Promise<UserProfile[]>;
    /** List the user's DM conversations. */
    getConversations(): Promise<BevoConversation[]>;
    /** Create or get an existing conversation with a peer. Returns the conversation id. */
    createOrGetConversation(peerPrincipalId: string): Promise<string>;
    /** Fetch messages for a conversation (newest last). */
    getMessages(conversationId: string, after?: string): Promise<BevoMessage[]>;
    /** Send a DM. Returns the created message. */
    sendMessage(conversationId: string, content: string): Promise<{
        message: BevoMessage;
    }>;
    /** Mark a conversation as read. */
    markRead(conversationId: string): Promise<void>;
    /** List groups the user belongs to. */
    getMyGroups(): Promise<BevoGroup[]>;
    /** Fetch a single group by its numeric ID. */
    getGroup(groupId: number): Promise<BevoGroup>;
    /** Search public groups. */
    searchGroups(query: string): Promise<BevoGroup[]>;
    /** Fetch messages from a group channel (newest last, max 100). */
    getGroupMessages(groupId: number, channelId: number, opts?: {
        limit?: number;
        before?: string;
    }): Promise<BevoGroupMessage[]>;
    /** Send a message to a group channel. Returns the created message. */
    sendGroupMessage(groupId: number, channelId: number, content: string): Promise<BevoGroupMessage>;
    /** List active apps in the Bevo app store. */
    getApps(params?: {
        search?: string;
        category?: string;
    }): Promise<BevoApp[]>;
    /** Get this mini-app's own manifest (by slug). */
    getApp(slug: string): Promise<{
        app: BevoApp;
        installed: boolean;
        grantedPermissions: string[];
    }>;
    /** List apps installed by the current user. */
    getInstalledApps(): Promise<BevoApp[]>;
    /** Install an app for the current user, granting the specified permissions. */
    installApp(slug: string, grantedPermissions?: BevoPermission[]): Promise<void>;
    /** Uninstall an app for the current user. */
    uninstallApp(slug: string): Promise<void>;
    /** List the current user's contact relationships. */
    getContacts(): Promise<BevoContact[]>;
    /** List active permission grants the current user has given to bot agents. */
    getMyPermissions(): Promise<BevoAgentPermission[]>;
}
/**
 * Entry point for mini-apps running inside the Bevo WebView.
 *
 * @example
 * ```ts
 * import { BevoMiniApp } from "@bevo/app-sdk";
 *
 * const bevo = BevoMiniApp.init();
 *
 * console.log(bevo.user.displayName); // "Alice"
 *
 * bevo.onUpdate((ctx) => {
 *   console.log("Balances updated:", ctx.balances);
 * });
 * ```
 */
declare class BevoMiniApp {
    private _context;
    readonly api: BevoApiClient;
    private constructor();
    /**
     * Initialize the SDK from `window.BevoContext`.
     * Call this once at app startup, after the DOM is ready.
     *
     * Throws if `window.BevoContext` is not yet available (i.e. the page is not
     * running inside the Bevo host app).
     */
    static init(): BevoMiniApp;
    /**
     * Initialize in dev mode with mock context — use this during local
     * development outside the Bevo host app.
     */
    static mock(overrides?: Partial<BevoContext>): BevoMiniApp;
    /** Raw BevoContext as injected by the host app. */
    get context(): BevoContext;
    /** The signed-in user's profile. */
    get user(): UserProfile;
    /** Current wallet balances (ETH/USDC/USDT). Null until fetched from chain. */
    get balances(): WalletBalances;
    /**
     * The user's hosted agent wallet info.
     * Null until the host app finishes the background fetch (~1-2 s after load).
     */
    get agent(): AgentInfo | null;
    /** True when the SDK is running inside the Bevo host app. */
    static get isInsideBevo(): boolean;
    /**
     * Subscribe to context updates (balances + agent wallet arriving async).
     * Returns an unsubscribe function.
     *
     * @example
     * const unsub = bevo.onUpdate((ctx) => {
     *   updateUI(ctx.balances);
     * });
     * // later: unsub();
     */
    onUpdate(callback: (context: BevoContext) => void): () => void;
    /**
     * Wait for balances to be available. Resolves as soon as non-null balances
     * arrive (or immediately if they're already loaded). Rejects after `timeoutMs`.
     */
    waitForBalances(timeoutMs?: number): Promise<WalletBalances>;
    /**
     * Wait for the agent wallet to be available. Resolves as soon as the host
     * app finishes its background fetch. Rejects after `timeoutMs`.
     */
    waitForAgent(timeoutMs?: number): Promise<AgentInfo>;
    /**
     * Ask the host app to sign and broadcast an arbitrary EVM transaction.
     *
     * The host presents a review sheet showing the target contract, value, and
     * calldata. The user must explicitly confirm before anything is signed.
     *
     * Resolves with `{ txHash }` on approval; rejects if the user cancels or
     * an error occurs.
     *
     * @example
     * const { txHash } = await bevo.requestSignTransaction({
     *   to: "0xContractAddress",
     *   data: "0xabcdef...",
     *   value: "0x0",
     *   description: "Mint NFT #42",
     * });
     */
    requestSignTransaction(params: SignTransactionParams): Promise<MiniAppTxResult>;
    /**
     * Ask the host app to open the native Send sheet pre-filled with the given
     * recipient and amount. The user still taps "Send" to confirm — this reuses
     * the exact same UI as sending from the wallet screen.
     *
     * Resolves with `{ txHash }` after the user completes the send; rejects if
     * cancelled or an error occurs.
     *
     * @example
     * const { txHash } = await bevo.requestSendTokens({
     *   toUserHandle: "alice",
     *   amount: 5,
     *   token: "USDC",
     * });
     */
    requestSendTokens(params: SendTokensParams): Promise<MiniAppTxResult>;
}

export { type AgentInfo, type AttachmentMessage, type BevoAgentPermission, BevoApiClient, type BevoApp, type BevoContact, type BevoContext, type BevoConversation, type BevoGroup, type BevoGroupMessage, type BevoMessage, BevoMiniApp, type BevoPermission, type MiniAppTxResult, type SendTokensParams, type SignTransactionParams, type UserProfile, type WalletBalances };
