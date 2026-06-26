"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BevoApiClient: () => BevoApiClient,
  BevoMiniApp: () => BevoMiniApp
});
module.exports = __toCommonJS(index_exports);

// src/app.ts
var _pending = /* @__PURE__ */ new Map();
var _reqCounter = 0;
function _installResolver() {
  if (typeof window === "undefined") return;
  window._bevoResolve = (id, result) => {
    const pending = _pending.get(id);
    if (!pending) return;
    _pending.delete(id);
    if (result.success && result.txHash) {
      pending.resolve({ txHash: result.txHash });
    } else {
      pending.reject(new Error(result.error ?? "Transaction rejected by user"));
    }
  };
}
function _postToHost(type, params) {
  if (typeof window === "undefined" || !window.BevoHost) {
    return Promise.reject(new Error("[bevo-app-sdk] BevoHost channel not available (not inside Bevo app)"));
  }
  _installResolver();
  const id = `bevo_req_${++_reqCounter}_${Date.now()}`;
  return new Promise((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    window.BevoHost.postMessage(JSON.stringify({ type, id, params }));
  });
}
var BevoApiClient = class {
  constructor(context) {
    this.context = context;
  }
  /** @internal Update context when the host app re-injects with fresh data. */
  _update(context) {
    this.context = context;
  }
  get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.context.authToken}`
    };
  }
  get base() {
    return this.context.apiBase.replace(/\/+$/, "");
  }
  /** Make an authenticated request to the Bevo backend. */
  async request(path, init = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...this.headers, ...init.headers }
    });
    if (!res.ok) {
      const text2 = await res.text().catch(() => res.statusText);
      throw new Error(`Bevo API ${init.method ?? "GET"} ${path} \u2192 ${res.status}: ${text2}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
  // ── Profile ───────────────────────────────────────────────────────────────
  /** Fetch the signed-in user's full backend profile. */
  getMyProfile() {
    return this.request("/api/users/me");
  }
  /** Fetch any user's public profile by principalId. */
  getUser(principalId) {
    return this.request(`/api/users/${encodeURIComponent(principalId)}`);
  }
  /** Update the signed-in user's profile. */
  updateProfile(data) {
    return this.request("/api/users/profile", {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  }
  /** Search users by display name, username, email, or wallet. */
  searchUsers(query) {
    return this.request(`/api/users/search?q=${encodeURIComponent(query)}`);
  }
  // ── DMs ───────────────────────────────────────────────────────────────────
  /** List the user's DM conversations. */
  async getConversations() {
    const data = await this.request(
      "/api/chat/conversations"
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  /** Create or get an existing conversation with a peer. Returns the conversation id. */
  async createOrGetConversation(peerPrincipalId) {
    const data = await this.request("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ peerPrincipalId })
    });
    return data.id;
  }
  /** Fetch messages for a conversation (newest last). */
  async getMessages(conversationId, after) {
    const params = after ? `?after=${encodeURIComponent(after)}` : "";
    const data = await this.request(
      `/api/chat/conversations/${conversationId}/messages${params}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  /** Send a DM. Returns the created message. */
  sendMessage(conversationId, content) {
    return this.request(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  }
  /** Mark a conversation as read. */
  markRead(conversationId) {
    return this.request(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST"
    });
  }
  // ── Groups ────────────────────────────────────────────────────────────────
  /** List groups the user belongs to. */
  async getMyGroups() {
    const principalId = this.context.principalId;
    const data = await this.request(
      `/api/groups/by-principal/${principalId}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  /** Fetch a single group by its numeric ID. */
  getGroup(groupId) {
    return this.request(`/api/groups/${groupId}`);
  }
  /** Search public groups. */
  async searchGroups(query) {
    const data = await this.request(
      `/api/groups/search?q=${encodeURIComponent(query)}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  /** Fetch messages from a group channel (newest last, max 100). */
  async getGroupMessages(groupId, channelId, opts = {}) {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.before) qs.set("before", opts.before);
    const data = await this.request(
      `/api/groups/${groupId}/channels/${channelId}/messages${qs.size ? `?${qs}` : ""}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  /** Send a message to a group channel. Returns the created message. */
  sendGroupMessage(groupId, channelId, content) {
    return this.request(`/api/groups/${groupId}/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  }
  // ── Apps ──────────────────────────────────────────────────────────────────
  /** List active apps in the Bevo app store. */
  async getApps(params) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    const data = await this.request(
      `/api/apps${qs.size ? `?${qs}` : ""}`
    );
    return data.items;
  }
  /** Get this mini-app's own manifest (by slug). */
  getApp(slug) {
    return this.request(`/api/apps/${slug}`);
  }
  /** List apps installed by the current user. */
  async getInstalledApps() {
    const data = await this.request("/api/apps/installed");
    return data.items;
  }
  /** Install an app for the current user, granting the specified permissions. */
  installApp(slug, grantedPermissions = []) {
    return this.request(`/api/apps/${slug}/install`, {
      method: "POST",
      body: JSON.stringify({ grantedPermissions })
    });
  }
  /** Uninstall an app for the current user. */
  uninstallApp(slug) {
    return this.request(`/api/apps/${slug}/install`, { method: "DELETE" });
  }
  // ── Contacts ─────────────────────────────────────────────────────────────
  /** List the current user's contact relationships. */
  async getContacts() {
    const data = await this.request("/api/contacts");
    return data.contacts;
  }
  // ── Permissions ───────────────────────────────────────────────────────────
  /** List active permission grants the current user has given to bot agents. */
  async getMyPermissions() {
    const data = await this.request("/api/agent-permissions/my");
    return data.items;
  }
};
var BevoMiniApp = class _BevoMiniApp {
  constructor(context) {
    this._context = context;
    this.api = new BevoApiClient(context);
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
  static init() {
    if (typeof window === "undefined" || !window.BevoContext) {
      throw new Error(
        "[bevo-app-sdk] window.BevoContext is not available. Make sure your mini-app is running inside the Bevo app WebView."
      );
    }
    return new _BevoMiniApp(window.BevoContext);
  }
  /**
   * Initialize in dev mode with mock context — use this during local
   * development outside the Bevo host app.
   */
  static mock(overrides = {}) {
    const mock = {
      authToken: "dev-token",
      apiBase: "http://localhost:5000",
      principalId: "dev-principal-id",
      walletAddress: "0xdevwallet",
      displayName: "Dev User",
      username: "devuser",
      avatar: "",
      balances: { eth: 1, usdc: 100, usdt: 0 },
      agentWalletAddress: "0xdevagentwallet",
      agentPrincipalId: "dev-agent-principal-id",
      ...overrides
    };
    if (typeof window !== "undefined") {
      window.BevoContext = mock;
    }
    return new _BevoMiniApp(mock);
  }
  /** Raw BevoContext as injected by the host app. */
  get context() {
    return this._context;
  }
  /** The signed-in user's profile. */
  get user() {
    return {
      principalId: this._context.principalId,
      walletAddress: this._context.walletAddress,
      displayName: this._context.displayName,
      username: this._context.username,
      avatar: this._context.avatar
    };
  }
  /** Current wallet balances (ETH/USDC/USDT). Null until fetched from chain. */
  get balances() {
    return this._context.balances;
  }
  /**
   * The user's hosted agent wallet info.
   * Null until the host app finishes the background fetch (~1-2 s after load).
   */
  get agent() {
    if (!this._context.agentWalletAddress || !this._context.agentPrincipalId) return null;
    return {
      walletAddress: this._context.agentWalletAddress,
      principalId: this._context.agentPrincipalId
    };
  }
  /** True when the SDK is running inside the Bevo host app. */
  static get isInsideBevo() {
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
  onUpdate(callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener("bevo:context-updated", handler);
    return () => window.removeEventListener("bevo:context-updated", handler);
  }
  /**
   * Wait for balances to be available. Resolves as soon as non-null balances
   * arrive (or immediately if they're already loaded). Rejects after `timeoutMs`.
   */
  waitForBalances(timeoutMs = 1e4) {
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
  waitForAgent(timeoutMs = 1e4) {
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
  requestSignTransaction(params) {
    return _postToHost("signTransaction", params);
  }
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
  requestSendTokens(params) {
    return _postToHost("sendTokens", params);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BevoApiClient,
  BevoMiniApp
});
