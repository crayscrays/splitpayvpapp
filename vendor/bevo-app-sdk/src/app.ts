import type {
  BevoContext,
  UserProfile,
  WalletBalances,
  AgentInfo,
  BevoConversation,
  BevoMessage,
  BevoGroup,
  BevoGroupMessage,
  BevoApp as BevoAppModel,
  BevoPermission,
  BevoContact,
  BevoAgentPermission,
} from "./types.js";

// ── BevoApiClient ─────────────────────────────────────────────────────────────

/**
 * Thin fetch wrapper pre-configured with the user's Bevo auth token.
 * Use it to call any Bevo backend endpoint from your mini-app.
 */
export class BevoApiClient {
  private context: BevoContext;

  constructor(context: BevoContext) {
    this.context = context;
  }

  /** @internal Update context when the host app re-injects with fresh data. */
  _update(context: BevoContext) {
    this.context = context;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.context.authToken}`,
    };
  }

  private get base(): string {
    return this.context.apiBase.replace(/\/+$/, "");
  }

  /** Make an authenticated request to the Bevo backend. */
  async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...this.headers, ...(init.headers as Record<string, string>) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Bevo API ${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  /** Fetch the signed-in user's full backend profile. */
  getMyProfile(): Promise<UserProfile> {
    return this.request("/api/users/me");
  }

  /** Fetch any user's public profile by principalId. */
  getUser(principalId: string): Promise<UserProfile> {
    return this.request(`/api/users/${encodeURIComponent(principalId)}`);
  }

  /** Update the signed-in user's profile. */
  updateProfile(data: Partial<Pick<UserProfile, "displayName" | "username">> & {
    bio?: string;
    searchableByHandle?: boolean;
    searchableByWallet?: boolean;
    searchableByEmail?: boolean;
  }): Promise<void> {
    return this.request("/api/users/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /** Search users by display name, username, email, or wallet. */
  searchUsers(query: string): Promise<UserProfile[]> {
    return this.request(`/api/users/search?q=${encodeURIComponent(query)}`);
  }

  // ── DMs ───────────────────────────────────────────────────────────────────

  /** List the user's DM conversations. */
  async getConversations(): Promise<BevoConversation[]> {
    const data = await this.request<{ items?: BevoConversation[] } | BevoConversation[]>(
      "/api/chat/conversations"
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  /** Create or get an existing conversation with a peer. Returns the conversation id. */
  async createOrGetConversation(peerPrincipalId: string): Promise<string> {
    const data = await this.request<{ id: string }>("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ peerPrincipalId }),
    });
    return data.id;
  }

  /** Fetch messages for a conversation (newest last). */
  async getMessages(conversationId: string, after?: string): Promise<BevoMessage[]> {
    const params = after ? `?after=${encodeURIComponent(after)}` : "";
    const data = await this.request<{ items?: BevoMessage[] } | BevoMessage[]>(
      `/api/chat/conversations/${conversationId}/messages${params}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  /** Send a DM. Returns the created message. */
  sendMessage(conversationId: string, content: string): Promise<{ message: BevoMessage }> {
    return this.request(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  /** Mark a conversation as read. */
  markRead(conversationId: string): Promise<void> {
    return this.request(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST",
    });
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  /** List groups the user belongs to. */
  async getMyGroups(): Promise<BevoGroup[]> {
    const principalId = this.context.principalId;
    const data = await this.request<{ items?: BevoGroup[] } | BevoGroup[]>(
      `/api/groups/by-principal/${principalId}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  /** Fetch a single group by its numeric ID. */
  getGroup(groupId: number): Promise<BevoGroup> {
    return this.request(`/api/groups/${groupId}`);
  }

  /** Search public groups. */
  async searchGroups(query: string): Promise<BevoGroup[]> {
    const data = await this.request<{ items?: BevoGroup[] } | BevoGroup[]>(
      `/api/groups/search?q=${encodeURIComponent(query)}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  /** Fetch messages from a group channel (newest last, max 100). */
  async getGroupMessages(
    groupId: number,
    channelId: number,
    opts: { limit?: number; before?: string } = {}
  ): Promise<BevoGroupMessage[]> {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.before) qs.set("before", opts.before);
    const data = await this.request<BevoGroupMessage[] | { items?: BevoGroupMessage[] }>(
      `/api/groups/${groupId}/channels/${channelId}/messages${qs.size ? `?${qs}` : ""}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  /** Send a message to a group channel. Returns the created message. */
  sendGroupMessage(groupId: number, channelId: number, content: string): Promise<BevoGroupMessage> {
    return this.request(`/api/groups/${groupId}/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  // ── Apps ──────────────────────────────────────────────────────────────────

  /** List active apps in the Bevo app store. */
  async getApps(params?: { search?: string; category?: string }): Promise<BevoAppModel[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    const data = await this.request<{ items: BevoAppModel[] }>(
      `/api/apps${qs.size ? `?${qs}` : ""}`
    );
    return data.items;
  }

  /** Get this mini-app's own manifest (by slug). */
  getApp(slug: string): Promise<{ app: BevoAppModel; installed: boolean; grantedPermissions: string[] }> {
    return this.request(`/api/apps/${slug}`);
  }

  /** List apps installed by the current user. */
  async getInstalledApps(): Promise<BevoAppModel[]> {
    const data = await this.request<{ items: BevoAppModel[] }>("/api/apps/installed");
    return data.items;
  }

  /** Install an app for the current user, granting the specified permissions. */
  installApp(slug: string, grantedPermissions: BevoPermission[] = []): Promise<void> {
    return this.request(`/api/apps/${slug}/install`, {
      method: "POST",
      body: JSON.stringify({ grantedPermissions }),
    });
  }

  /** Uninstall an app for the current user. */
  uninstallApp(slug: string): Promise<void> {
    return this.request(`/api/apps/${slug}/install`, { method: "DELETE" });
  }

  // ── Contacts ─────────────────────────────────────────────────────────────

  /** List the current user's contact relationships. */
  async getContacts(): Promise<BevoContact[]> {
    const data = await this.request<{ contacts: BevoContact[] }>("/api/contacts");
    return data.contacts;
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  /** List active permission grants the current user has given to bot agents. */
  async getMyPermissions(): Promise<BevoAgentPermission[]> {
    const data = await this.request<{ items: BevoAgentPermission[] }>("/api/agent-permissions/my");
    return data.items;
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  /**
   * Request a token transfer from the user's agent wallet.
   * Requires the `wallet.send` permission to have been granted at install.
   */
  transferTokens(params: {
    toUserHandle?: string;
    toUserWallet?: string;
    amountEth: number;
    token?: "ETH" | "USDC" | "USDT";
    fromWallet?: "agent" | "personal";
  }): Promise<{ txHash: string; fromWallet: string; toWallet: string; amount: number; token: string }> {
    return this.request("/api/wallet/transfer", {
      method: "POST",
      body: JSON.stringify({ chainId: 8453, ...params }),
    });
  }
}

// ── BevoMiniApp ───────────────────────────────────────────────────────────────

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
export class BevoMiniApp {
  private _context: BevoContext;
  readonly api: BevoApiClient;

  private constructor(context: BevoContext) {
    this._context = context;
    this.api = new BevoApiClient(context);

    // Keep context up to date when the host app re-injects.
    window.addEventListener("bevo:context-updated", (e) => {
      this._context = e.detail;
      this.api._update(e.detail);
    });
  }

  /**
   * Initialize the SDK from `window.BevoContext`.
   * Call this once at app startup, after the DOM is ready.
   *
   * Throws if `window.BevoContext` is not yet available (i.e. the page is not
   * running inside the Bevo host app).
   */
  static init(): BevoMiniApp {
    if (typeof window === "undefined" || !window.BevoContext) {
      throw new Error(
        "[bevo-app-sdk] window.BevoContext is not available. " +
          "Make sure your mini-app is running inside the Bevo app WebView."
      );
    }
    return new BevoMiniApp(window.BevoContext);
  }

  /**
   * Initialize in dev mode with mock context — use this during local
   * development outside the Bevo host app.
   */
  static mock(overrides: Partial<BevoContext> = {}): BevoMiniApp {
    const mock: BevoContext = {
      authToken: "dev-token",
      apiBase: "http://localhost:5000",
      principalId: "dev-principal-id",
      walletAddress: "0xdevwallet",
      displayName: "Dev User",
      username: "devuser",
      avatar: "",
      balances: { eth: 1.0, usdc: 100.0, usdt: 0.0 },
      agentWalletAddress: "0xdevagentwallet",
      agentPrincipalId: "dev-agent-principal-id",
      ...overrides,
    };
    if (typeof window !== "undefined") {
      window.BevoContext = mock;
    }
    return new BevoMiniApp(mock);
  }

  /** Raw BevoContext as injected by the host app. */
  get context(): BevoContext {
    return this._context;
  }

  /** The signed-in user's profile. */
  get user(): UserProfile {
    return {
      principalId: this._context.principalId,
      walletAddress: this._context.walletAddress,
      displayName: this._context.displayName,
      username: this._context.username,
      avatar: this._context.avatar,
    };
  }

  /** Current wallet balances (ETH/USDC/USDT). Null until fetched from chain. */
  get balances(): WalletBalances {
    return this._context.balances;
  }

  /**
   * The user's hosted agent wallet info.
   * Null until the host app finishes the background fetch (~1-2 s after load).
   */
  get agent(): AgentInfo | null {
    if (!this._context.agentWalletAddress || !this._context.agentPrincipalId) return null;
    return {
      walletAddress: this._context.agentWalletAddress,
      principalId: this._context.agentPrincipalId,
    };
  }

  /** True when the SDK is running inside the Bevo host app. */
  static get isInsideBevo(): boolean {
    return typeof window !== "undefined" && !!window.BevoContext;
  }

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
  onUpdate(callback: (context: BevoContext) => void): () => void {
    const handler = (e: CustomEvent<BevoContext>) => callback(e.detail);
    window.addEventListener("bevo:context-updated", handler);
    return () => window.removeEventListener("bevo:context-updated", handler);
  }

  /**
   * Wait for balances to be available. Resolves as soon as non-null balances
   * arrive (or immediately if they're already loaded). Rejects after `timeoutMs`.
   */
  waitForBalances(timeoutMs = 10_000): Promise<WalletBalances> {
    if (this._context.balances.eth !== null) {
      return Promise.resolve(this._context.balances);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for wallet balances")),
        timeoutMs
      );
      const unsub = this.onUpdate((ctx) => {
        if (ctx.balances.eth !== null) {
          clearTimeout(timer);
          unsub();
          resolve(ctx.balances);
        }
      });
    });
  }

  /**
   * Wait for the agent wallet to be available. Resolves as soon as the host
   * app finishes its background fetch. Rejects after `timeoutMs`.
   */
  waitForAgent(timeoutMs = 10_000): Promise<AgentInfo> {
    if (this.agent) return Promise.resolve(this.agent);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for agent wallet")),
        timeoutMs
      );
      const unsub = this.onUpdate((_ctx) => {
        const a = this.agent;
        if (a) {
          clearTimeout(timer);
          unsub();
          resolve(a);
        }
      });
    });
  }
}
