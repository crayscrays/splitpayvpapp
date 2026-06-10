"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BevoApiClient: () => BevoApiClient,
  BevoMiniApp: () => BevoMiniApp
});
module.exports = __toCommonJS(index_exports);

// src/app.ts
var BevoApiClient = class {
  constructor(context) {
    __publicField(this, "context");
    this.context = context;
  }
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
  getMyProfile() {
    return this.request("/api/users/me");
  }
  updateProfile(data) {
    return this.request("/api/users/profile", {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  }
  searchUsers(query) {
    return this.request(`/api/users/search?q=${encodeURIComponent(query)}`);
  }
  async getConversations() {
    const data = await this.request(
      "/api/chat/conversations"
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  async createOrGetConversation(peerPrincipalId) {
    const data = await this.request("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ peerPrincipalId })
    });
    return data.id;
  }
  async getMessages(conversationId, after) {
    const params = after ? `?after=${encodeURIComponent(after)}` : "";
    const data = await this.request(
      `/api/chat/conversations/${conversationId}/messages${params}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  sendMessage(conversationId, content) {
    return this.request(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  }
  markRead(conversationId) {
    return this.request(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST"
    });
  }
  async getMyGroups() {
    const principalId = this.context.principalId;
    const data = await this.request(
      `/api/groups/by-principal/${principalId}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  async searchGroups(query) {
    const data = await this.request(
      `/api/groups/search?q=${encodeURIComponent(query)}`
    );
    return Array.isArray(data) ? data : data.items ?? [];
  }
  async getApps(params) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    const data = await this.request(
      `/api/apps${qs.size ? `?${qs}` : ""}`
    );
    return data.items;
  }
  getApp(slug) {
    return this.request(`/api/apps/${slug}`);
  }
  transferTokens(params) {
    return this.request("/api/wallet/transfer", {
      method: "POST",
      body: JSON.stringify({ chainId: 8453, ...params })
    });
  }
};
var BevoMiniApp = class _BevoMiniApp {
  constructor(context) {
    __publicField(this, "_context");
    __publicField(this, "api");
    this._context = context;
    this.api = new BevoApiClient(context);
    window.addEventListener("bevo:context-updated", (e) => {
      this._context = e.detail;
      this.api._update(e.detail);
    });
  }
  static init() {
    if (typeof window === "undefined" || !window.BevoContext) {
      throw new Error(
        "[bevo-app-sdk] window.BevoContext is not available. Make sure your mini-app is running inside the Bevo app WebView."
      );
    }
    return new _BevoMiniApp(window.BevoContext);
  }
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
  get context() {
    return this._context;
  }
  get user() {
    return {
      principalId: this._context.principalId,
      walletAddress: this._context.walletAddress,
      displayName: this._context.displayName,
      username: this._context.username,
      avatar: this._context.avatar
    };
  }
  get balances() {
    return this._context.balances;
  }
  get agent() {
    if (!this._context.agentWalletAddress || !this._context.agentPrincipalId) return null;
    return {
      walletAddress: this._context.agentWalletAddress,
      principalId: this._context.agentPrincipalId
    };
  }
  static get isInsideBevo() {
    return typeof window !== "undefined" && !!window.BevoContext;
  }
  onUpdate(callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener("bevo:context-updated", handler);
    return () => window.removeEventListener("bevo:context-updated", handler);
  }
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
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BevoApiClient,
  BevoMiniApp
});
