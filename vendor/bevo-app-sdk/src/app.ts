import type {
  BevoContext,
  UserProfile,
  WalletBalances,
  AgentInfo,
  BevoConversation,
  BevoMessage,
  BevoGroup,
  BevoApp as BevoAppModel,
} from "./types.js";

export class BevoApiClient {
  private context: BevoContext;

  constructor(context: BevoContext) {
    this.context = context;
  }

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

  getMyProfile(): Promise<UserProfile> {
    return this.request("/api/users/me");
  }

  updateProfile(data: Partial<Pick<UserProfile, "displayName" | "username">> & { bio?: string }): Promise<void> {
    return this.request("/api/users/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  searchUsers(query: string): Promise<UserProfile[]> {
    return this.request(`/api/users/search?q=${encodeURIComponent(query)}`);
  }

  async getConversations(): Promise<BevoConversation[]> {
    const data = await this.request<{ items?: BevoConversation[] } | BevoConversation[]>(
      "/api/chat/conversations"
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async createOrGetConversation(peerPrincipalId: string): Promise<string> {
    const data = await this.request<{ id: string }>("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ peerPrincipalId }),
    });
    return data.id;
  }

  async getMessages(conversationId: string, after?: string): Promise<BevoMessage[]> {
    const params = after ? `?after=${encodeURIComponent(after)}` : "";
    const data = await this.request<{ items?: BevoMessage[] } | BevoMessage[]>(
      `/api/chat/conversations/${conversationId}/messages${params}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  sendMessage(conversationId: string, content: string): Promise<{ message: BevoMessage }> {
    return this.request(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  markRead(conversationId: string): Promise<void> {
    return this.request(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST",
    });
  }

  async getMyGroups(): Promise<BevoGroup[]> {
    const principalId = this.context.principalId;
    const data = await this.request<{ items?: BevoGroup[] } | BevoGroup[]>(
      `/api/groups/by-principal/${principalId}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async searchGroups(query: string): Promise<BevoGroup[]> {
    const data = await this.request<{ items?: BevoGroup[] } | BevoGroup[]>(
      `/api/groups/search?q=${encodeURIComponent(query)}`
    );
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async getApps(params?: { search?: string; category?: string }): Promise<BevoAppModel[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    const data = await this.request<{ items: BevoAppModel[] }>(
      `/api/apps${qs.size ? `?${qs}` : ""}`
    );
    return data.items;
  }

  getApp(slug: string): Promise<{ app: BevoAppModel; installed: boolean; grantedPermissions: string[] }> {
    return this.request(`/api/apps/${slug}`);
  }

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

export class BevoMiniApp {
  private _context: BevoContext;
  readonly api: BevoApiClient;

  private constructor(context: BevoContext) {
    this._context = context;
    this.api = new BevoApiClient(context);

    window.addEventListener("bevo:context-updated", (e) => {
      this._context = e.detail;
      this.api._update(e.detail);
    });
  }

  static init(): BevoMiniApp {
    if (typeof window === "undefined" || !window.BevoContext) {
      throw new Error(
        "[bevo-app-sdk] window.BevoContext is not available. " +
          "Make sure your mini-app is running inside the Bevo app WebView."
      );
    }
    return new BevoMiniApp(window.BevoContext);
  }

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

  get context(): BevoContext {
    return this._context;
  }

  get user(): UserProfile {
    return {
      principalId: this._context.principalId,
      walletAddress: this._context.walletAddress,
      displayName: this._context.displayName,
      username: this._context.username,
      avatar: this._context.avatar,
    };
  }

  get balances(): WalletBalances {
    return this._context.balances;
  }

  get agent(): AgentInfo | null {
    if (!this._context.agentWalletAddress || !this._context.agentPrincipalId) return null;
    return {
      walletAddress: this._context.agentWalletAddress,
      principalId: this._context.agentPrincipalId,
    };
  }

  static get isInsideBevo(): boolean {
    return typeof window !== "undefined" && !!window.BevoContext;
  }

  onUpdate(callback: (context: BevoContext) => void): () => void {
    const handler = (e: CustomEvent<BevoContext>) => callback(e.detail);
    window.addEventListener("bevo:context-updated", handler);
    return () => window.removeEventListener("bevo:context-updated", handler);
  }

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
