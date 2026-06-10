import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GroupMember, GroupSummary } from "./bridge";
import type { UserProfile } from "@bevo/app-sdk";
import { bridge } from "./bridge";
import { computeNetBalances, formatAddress, genCode, normalizeWallet, publishCode, simplifyDebts, uid, type DebtEdge } from "./utils";
import { deleteExpenseRemote, fetchExpenses, fetchGroupById, fetchGroups, fetchMembers, publishExpense, publishGroup, publishMember, supabase } from "./supabase";

// ---------- Types ----------

export interface Split {
  wallet: string;
  amount: number;
  settled: boolean;
  txHash?: string;
  settledAt?: string;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: "equal" | "custom";
  splits: Split[];
  createdAt: string;
}

export interface Activity {
  id: string;
  groupId: string;
  type:
    | "expense_added"
    | "expense_edited"
    | "expense_deleted"
    | "payment_settled"
    | "group_joined";
  message: string;
  actor: string;
  createdAt: string;
  meta?: Record<string, any>;
}

export interface GroupData {
  id: string;
  name: string;
  avatar: string;
  memberCount: number;
  members: GroupMember[];
  expenses: Expense[];
  activity: Activity[];
  inviteCode: string;
}

export interface InviteInfo {
  id: string;
  name: string;
  creator: string; // wallet address
  creatorName?: string;
  inviteCode?: string;
}

// ---------- State ----------

interface State {
  profile: UserProfile | null;
  balance: string;
  groups: GroupData[];
  availableGroups: GroupSummary[];
  loading: boolean;
  mode: "live" | "disconnected" | "loading";
}

type Action =
  | { type: "INIT"; payload: Partial<State> }
  | { type: "SET_AVAILABLE"; groups: GroupSummary[] }
  | { type: "ADD_GROUP"; group: GroupData }
  | { type: "SYNC_MEMBERS"; groupId: string; member: GroupMember }
  | { type: "SYNC_EXPENSE"; expense: Expense }
  | { type: "REMOVE_EXPENSE"; groupId: string; expenseId: string }
  | { type: "ADD_EXPENSE"; groupId: string; expense: Expense; activity: Activity }
  | { type: "EDIT_EXPENSE"; groupId: string; expense: Expense; activity: Activity }
  | { type: "DELETE_EXPENSE"; groupId: string; expenseId: string; activity?: Activity }
  | {
      type: "SETTLE_SPLIT";
      groupId: string;
      expenseId: string;
      wallet: string;
      txHash: string;
      activity: Activity;
    }
  | { type: "SET_BALANCE"; balance: string };

const initialState: State = {
  profile: null,
  balance: "0",
  groups: [],
  availableGroups: [],
  loading: true,
  mode: "loading",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT":
      return { ...state, ...action.payload, loading: false };
    case "SET_AVAILABLE":
      return { ...state, availableGroups: action.groups };
    case "ADD_GROUP":
      return {
        ...state,
        groups: [...state.groups, action.group],
        availableGroups: state.availableGroups.filter((g) => g.id !== action.group.id),
      };
    case "SYNC_MEMBERS":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const already = g.members.some(
            (m) => m.walletAddress === action.member.walletAddress
          );
          if (already) return g;
          return {
            ...g,
            members: [...g.members, action.member],
            memberCount: g.memberCount + 1,
          };
        }),
      };
    case "SYNC_EXPENSE":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.expense.groupId) return g;
          const idx = g.expenses.findIndex((e) => e.id === action.expense.id);
          return {
            ...g,
            expenses:
              idx >= 0
                ? g.expenses.map((e) => (e.id === action.expense.id ? action.expense : e))
                : [action.expense, ...g.expenses],
          };
        }),
      };
    case "REMOVE_EXPENSE":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? { ...g, expenses: g.expenses.filter((e) => e.id !== action.expenseId) }
            : g
        ),
      };
    case "ADD_EXPENSE":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                expenses: [action.expense, ...g.expenses],
                activity: [action.activity, ...g.activity],
              }
            : g
        ),
      };
    case "EDIT_EXPENSE":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                expenses: g.expenses.map((e) =>
                  e.id === action.expense.id ? action.expense : e
                ),
                activity: [action.activity, ...g.activity],
              }
            : g
        ),
      };
    case "DELETE_EXPENSE":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                expenses: g.expenses.filter((e) => e.id !== action.expenseId),
                activity: action.activity ? [action.activity, ...g.activity] : g.activity,
              }
            : g
        ),
      };
    case "SETTLE_SPLIT":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                expenses: g.expenses.map((e) =>
                  e.id === action.expenseId
                    ? {
                        ...e,
                        splits: e.splits.map((s) =>
                          s.wallet === action.wallet
                            ? {
                                ...s,
                                settled: true,
                                txHash: action.txHash,
                                settledAt: new Date().toISOString(),
                              }
                            : s
                        ),
                      }
                    : e
                ),
                activity: [action.activity, ...g.activity],
              }
            : g
        ),
      };
    case "SET_BALANCE":
      return { ...state, balance: action.balance };
    default:
      return state;
  }
}

// ---------- Context ----------

interface SplitPayContextValue extends State {
  totalOwed: number;
  totalOwing: number;
  addExpense(input: Omit<Expense, "id" | "createdAt">): Expense;
  editExpense(expense: Expense): void;
  deleteExpense(groupId: string, expenseId: string): void;
  settleSplit(args: {
    groupId: string;
    expenseId: string;
    wallet: string;
    amount: number;
    toWallet: string;
  }): Promise<string>;
  addGroup(group: GroupSummary): Promise<void>;
  createGroup(name: string, members: GroupMember[]): Promise<GroupData>;
  joinGroup(invite: InviteInfo): Promise<void>;
  makeInviteCode(groupId: string): string; // returns the 6-char code
  makeInviteUrl(groupId: string): string;  // returns the full shareable URL
  refreshGroups(): Promise<void>;
  refreshAvailableGroups(): Promise<void>;
  shareExpenseToGroup(groupId: string, expense: Expense): Promise<void>;
  getGroup(id: string): GroupData | undefined;
  computeGroupBalances(groupId: string): Record<string, number>;
  computeGroupDebts(groupId: string): DebtEdge[];
  disconnect(): void;
}

const Ctx = createContext<SplitPayContextValue | null>(null);

export function SplitPayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [booted, setBooted] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Initial load — check connection state, restore wallet-keyed data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await bridge.getProfileOrNull();
      if (cancelled) return;

      if (!profile) {
        // No wallet connected — show the connect screen
        dispatch({ type: "INIT", payload: { mode: "disconnected" } });
        setBooted(true);
        return;
      }

      const [balance] = await Promise.all([bridge.getBalance("USDC")]);
      if (cancelled) return;

      // Load all groups and their data from Supabase
      const groupMetas = await fetchGroups(profile.walletAddress);
      const saved = await Promise.all(
        groupMetas.map(async (meta) => {
          const [remoteMembers, remoteExpenses] = await Promise.all([
            fetchMembers(meta.id),
            fetchExpenses(meta.id),
          ]);
          const expenses = (remoteExpenses as Expense[]).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return {
            id: meta.id,
            name: meta.name,
            avatar: meta.avatar,
            inviteCode: meta.inviteCode || genCode(),
            memberCount: remoteMembers.length,
            members: remoteMembers,
            expenses,
            activity: [],
          } as GroupData;
        })
      );

      dispatch({
        type: "INIT",
        payload: {
          profile: { ...profile, walletAddress: normalizeWallet(profile.walletAddress) },
          balance,
          groups: saved,
          mode: "live",
        },
      });
      setBooted(true);

      try {
        const available = await bridge.listGroups();
        if (cancelled) return;
        const added = new Set((saved ?? []).map((g) => g.id));
        dispatch({ type: "SET_AVAILABLE", groups: available.filter((g) => !added.has(g.id)) });
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Real-time: sync members and expenses across all our groups
  useEffect(() => {
    if (!booted || state.groups.length === 0) return;
    const sb = supabase;
    if (!sb) return;
    const groupIds = new Set(state.groups.map((g) => g.id));

    const channel = sb
      .channel("splitpay_sync")
      // New member joined
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_members" },
        (payload) => {
          const row = payload.new as { group_id: string; wallet_address: string; display_name: string; avatar: string; roles: string[] };
          if (!groupIds.has(row.group_id)) return;
          dispatch({
            type: "SYNC_MEMBERS",
            groupId: row.group_id,
            member: { walletAddress: row.wallet_address, displayName: row.display_name, avatar: row.avatar, roles: row.roles },
          });
        }
      )
      // Expense added or updated (upsert triggers INSERT then UPDATE)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_expenses" },
        (payload) => {
          const expense = (payload.new as { data: Expense }).data;
          if (expense && groupIds.has(expense.groupId)) {
            dispatch({ type: "SYNC_EXPENSE", expense });
          }
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_expenses" },
        (payload) => {
          const expense = (payload.new as { data: Expense }).data;
          if (expense && groupIds.has(expense.groupId)) {
            dispatch({ type: "SYNC_EXPENSE", expense });
          }
        }
      )
      // Expense deleted
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_expenses" },
        (payload) => {
          const row = payload.old as { id: string; group_id: string };
          if (row.group_id && groupIds.has(row.group_id)) {
            dispatch({ type: "REMOVE_EXPENSE", groupId: row.group_id, expenseId: row.id });
          }
        }
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [booted, state.groups.length]);

  // Real-time: detect when an external agent adds the current user to a new group
  useEffect(() => {
    if (!booted || !state.profile?.walletAddress) return;
    const sb = supabase;
    if (!sb) return;
    const myWallet = state.profile.walletAddress;

    const channel = sb
      .channel("splitpay_new_groups")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_members" },
        async (payload) => {
          const row = payload.new as { group_id: string; wallet_address: string };
          if (row.wallet_address.toLowerCase() !== myWallet.toLowerCase()) return;
          if (stateRef.current.groups.some((g) => g.id === row.group_id)) return;
          const groupMeta = await fetchGroupById(row.group_id);
          if (!groupMeta) return;
          const [members, expenses] = await Promise.all([
            fetchMembers(row.group_id),
            fetchExpenses(row.group_id),
          ]);
          const sortedExpenses = (expenses as Expense[]).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          dispatch({
            type: "ADD_GROUP",
            group: {
              id: groupMeta.id,
              name: groupMeta.name,
              avatar: groupMeta.avatar,
              inviteCode: groupMeta.inviteCode || genCode(),
              memberCount: members.length,
              members,
              expenses: sortedExpenses,
              activity: [],
            },
          });
        }
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [booted, state.profile?.walletAddress]);

  const addExpense: SplitPayContextValue["addExpense"] = useCallback((input) => {
    const expense: Expense = {
      ...input,
      id: uid("exp"),
      createdAt: new Date().toISOString(),
    };
    const activity: Activity = {
      id: uid("act"),
      groupId: expense.groupId,
      type: "expense_added",
      message: `${expense.description} · $${expense.amount.toFixed(2)}`,
      actor: expense.paidBy,
      createdAt: expense.createdAt,
    };
    publishExpense(expense);
    dispatch({ type: "ADD_EXPENSE", groupId: expense.groupId, expense, activity });
    return expense;
  }, []);

  const editExpense: SplitPayContextValue["editExpense"] = useCallback((expense) => {
    const activity: Activity = {
      id: uid("act"),
      groupId: expense.groupId,
      type: "expense_edited",
      message: `${expense.description} updated · $${expense.amount.toFixed(2)}`,
      actor: expense.paidBy,
      createdAt: new Date().toISOString(),
    };
    publishExpense(expense);
    dispatch({ type: "EDIT_EXPENSE", groupId: expense.groupId, expense, activity });
  }, []);

  const deleteExpense: SplitPayContextValue["deleteExpense"] = useCallback(
    (groupId, expenseId) => {
      const activity: Activity = {
        id: uid("act"),
        groupId,
        type: "expense_deleted",
        message: "Expense removed",
        actor: "",
        createdAt: new Date().toISOString(),
      };
      deleteExpenseRemote(expenseId);
      dispatch({ type: "DELETE_EXPENSE", groupId, expenseId, activity });
    },
    []
  );

  const settleSplit: SplitPayContextValue["settleSplit"] = useCallback(
    async ({ groupId, expenseId, wallet, amount, toWallet }) => {
      const txHash = await bridge.sendTransaction({
        to: toWallet,
        token: "USDC",
        amount: amount.toFixed(2),
      });
      const now = new Date().toISOString();
      const activity: Activity = {
        id: uid("act"),
        groupId,
        type: "payment_settled",
        message: `Paid $${amount.toFixed(2)} USDC`,
        actor: wallet,
        createdAt: now,
        meta: { txHash, toWallet, amount },
      };
      dispatch({ type: "SETTLE_SPLIT", groupId, expenseId, wallet, txHash, activity });
      // Publish updated expense so other devices see the settled state
      const group = stateRef.current.groups.find((g) => g.id === groupId);
      const expense = group?.expenses.find((e) => e.id === expenseId);
      if (expense) {
        publishExpense({
          ...expense,
          splits: expense.splits.map((s) =>
            s.wallet === wallet ? { ...s, settled: true, txHash, settledAt: now } : s
          ),
        });
      }
      return txHash;
    },
    []
  );

  const addGroup: SplitPayContextValue["addGroup"] = useCallback(async (summary) => {
    const members = await bridge.getGroupMembers(summary.id);
    const code = genCode();
    const admin = members.find((m) => m.roles?.includes("admin")) ?? members[0];
    publishCode(code, {
      id: summary.id,
      name: summary.name,
      creator: admin?.walletAddress ?? "",
      creatorName: admin?.displayName,
      inviteCode: code,
    });
    const newGroup: GroupData = {
      id: summary.id,
      name: summary.name,
      avatar: summary.avatar,
      memberCount: summary.memberCount || members.length,
      members,
      expenses: [],
      activity: [
        {
          id: uid("act"),
          groupId: summary.id,
          type: "group_joined",
          message: "Group linked to SplitPay",
          actor: "",
          createdAt: new Date().toISOString(),
        },
      ],
      inviteCode: code,
    };
    await publishGroup({ id: newGroup.id, name: newGroup.name, avatar: newGroup.avatar, inviteCode: code });
    members.forEach((m) => publishMember(summary.id, m));
    dispatch({ type: "ADD_GROUP", group: newGroup });
  }, []);

  const createGroup: SplitPayContextValue["createGroup"] = useCallback(
    async (name, members) => {
      const id = uid("grp");
      const code = genCode();
      const admin = members.find((m) => m.roles?.includes("admin"));
      publishCode(code, {
        id,
        name,
        creator: admin?.walletAddress ?? "",
        creatorName: admin?.displayName,
        inviteCode: code,
      });
      const newGroup: GroupData = {
        id,
        name,
        avatar: "",
        memberCount: members.length,
        members,
        expenses: [],
        activity: [
          {
            id: uid("act"),
            groupId: id,
            type: "group_joined",
            message: "Group created",
            actor: admin?.walletAddress ?? "",
            createdAt: new Date().toISOString(),
          },
        ],
        inviteCode: code,
      };
      await publishGroup({ id, name, avatar: "", inviteCode: code });
      members.forEach((m) => publishMember(id, m));
      dispatch({ type: "ADD_GROUP", group: newGroup });
      return newGroup;
    },
    []
  );

  const joinGroup: SplitPayContextValue["joinGroup"] = useCallback(
    async (invite) => {
      if (state.groups.some((g) => g.id === invite.id)) return;
      const myWallet = state.profile?.walletAddress ?? "";

      // Resolve creator name: invite embed > 0xChat contact lookup > truncated address
      let creatorName = invite.creatorName ?? null;
      let creatorAvatar = "";
      if (!creatorName) {
        const contact = await bridge.resolveContact(invite.creator);
        if (contact) {
          creatorName = contact.displayName;
          creatorAvatar = contact.avatar;
        }
      }

      const code = invite.inviteCode ?? genCode();
      publishCode(code, invite);

      // Fetch all existing members from Supabase so the joiner sees everyone
      const remoteMembers = await fetchMembers(invite.id);
      const joinerMember: GroupMember = {
        walletAddress: myWallet,
        displayName: state.profile?.displayName ?? "You",
        avatar: state.profile?.avatar ?? "",
        roles: [],
      };
      // Publish group record first, then member (FK ordering)
      await publishGroup({ id: invite.id, name: invite.name, avatar: "", inviteCode: code });
      publishMember(invite.id, joinerMember);

      // Merge remote members with known creator, deduplicating by wallet
      const seen = new Set<string>();
      const allMembers: GroupMember[] = [];
      for (const m of [
        ...remoteMembers,
        {
          walletAddress: invite.creator,
          displayName: creatorName ?? formatAddress(invite.creator, 4),
          avatar: creatorAvatar,
          roles: ["admin"] as string[],
        },
        joinerMember,
      ]) {
        if (!seen.has(m.walletAddress)) {
          seen.add(m.walletAddress);
          allMembers.push(m);
        }
      }

      const newGroup: GroupData = {
        id: invite.id,
        name: invite.name,
        avatar: "",
        memberCount: allMembers.length,
        inviteCode: code,
        members: allMembers,
        expenses: [],
        activity: [
          {
            id: uid("act"),
            groupId: invite.id,
            type: "group_joined",
            message: "You joined the group",
            actor: myWallet,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      dispatch({ type: "ADD_GROUP", group: newGroup });
    },
    [state.groups, state.profile]
  );

  const makeInviteCode: SplitPayContextValue["makeInviteCode"] = useCallback(
    (groupId) => {
      const group = state.groups.find((g) => g.id === groupId);
      return group?.inviteCode ?? "";
    },
    [state.groups]
  );

  const makeInviteUrl: SplitPayContextValue["makeInviteUrl"] = useCallback(
    (groupId) => {
      const group = state.groups.find((g) => g.id === groupId);
      if (!group) return "";
      const info: InviteInfo = {
        id: group.id,
        name: group.name,
        creator: state.profile?.walletAddress ?? "",
        creatorName: state.profile?.displayName ?? undefined,
        inviteCode: group.inviteCode,
      };
      publishCode(group.inviteCode, info);
      const data = encodeURIComponent(btoa(JSON.stringify(info)));
      const base = window.location.href.split("#")[0];
      return `${base}#/join/${group.inviteCode}?d=${data}`;
    },
    [state.groups, state.profile]
  );

  const refreshGroups: SplitPayContextValue["refreshGroups"] = useCallback(async () => {
    const wallet = stateRef.current.profile?.walletAddress;
    if (!wallet) return;
    const groupMetas = await fetchGroups(wallet);
    const knownIds = new Set(stateRef.current.groups.map((g) => g.id));
    const newMetas = groupMetas.filter((m) => !knownIds.has(m.id));
    for (const meta of newMetas) {
      const [members, expenses] = await Promise.all([
        fetchMembers(meta.id),
        fetchExpenses(meta.id),
      ]);
      const sortedExpenses = (expenses as Expense[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      dispatch({
        type: "ADD_GROUP",
        group: {
          id: meta.id,
          name: meta.name,
          avatar: meta.avatar,
          inviteCode: meta.inviteCode || genCode(),
          memberCount: members.length,
          members,
          expenses: sortedExpenses,
          activity: [],
        },
      });
    }
  }, []);

  // Auto-refresh when the user returns to the tab
  useEffect(() => {
    if (!booted) return;
    const handle = () => { if (document.visibilityState === "visible") refreshGroups(); };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [booted, refreshGroups]);

  const refreshAvailableGroups: SplitPayContextValue["refreshAvailableGroups"] = useCallback(
    async () => {
      const available = await bridge.listGroups();
      const added = new Set(state.groups.map((g) => g.id));
      dispatch({
        type: "SET_AVAILABLE",
        groups: available.filter((g) => !added.has(g.id)),
      });
    },
    [state.groups]
  );

  const shareExpenseToGroup: SplitPayContextValue["shareExpenseToGroup"] = useCallback(
    async (groupId, expense) => {
      await bridge.shareCardToGroup({
        groupId,
        channelId: groupId,
        card: {
          type: "app_card",
          title: expense.description,
          subtitle: `$${expense.amount.toFixed(2)} · split ${expense.splitType}`,
          fields: [
            { label: "Amount", value: `$${expense.amount.toFixed(2)} USDC` },
            { label: "Split", value: `${expense.splits.length} people` },
          ],
          actions: [{ id: "open", label: "Open in SplitPay", kind: "open_app", appSlug: "splitpay" }],
        },
      });
    },
    []
  );

  const getGroup: SplitPayContextValue["getGroup"] = useCallback(
    (id) => state.groups.find((g) => g.id === id),
    [state.groups]
  );

  const computeGroupBalances: SplitPayContextValue["computeGroupBalances"] = useCallback(
    (groupId) => {
      const g = state.groups.find((x) => x.id === groupId);
      if (!g) return {};
      return computeNetBalances({ expenses: g.expenses });
    },
    [state.groups]
  );

  const computeGroupDebts: SplitPayContextValue["computeGroupDebts"] = useCallback(
    (groupId) => simplifyDebts(computeGroupBalances(groupId)),
    [computeGroupBalances]
  );

  const { totalOwed, totalOwing } = useMemo(() => {
    const me = state.profile?.walletAddress;
    if (!me) return { totalOwed: 0, totalOwing: 0 };
    let owed = 0;
    let owing = 0;
    for (const g of state.groups) {
      const bal = computeNetBalances({ expenses: g.expenses });
      const my = bal[me] ?? 0;
      if (my > 0) owed += my;
      else if (my < 0) owing += -my;
    }
    return {
      totalOwed: Math.round(owed * 100) / 100,
      totalOwing: Math.round(owing * 100) / 100,
    };
  }, [state.groups, state.profile?.walletAddress]);

  const disconnect = useCallback(() => {
    dispatch({ type: "INIT", payload: { profile: null, groups: [], mode: "disconnected" } });
    setBooted(false);
  }, []);

  const value: SplitPayContextValue = {
    ...state,
    totalOwed,
    totalOwing,
    addExpense,
    editExpense,
    deleteExpense,
    settleSplit,
    addGroup,
    createGroup,
    joinGroup,
    makeInviteCode,
    makeInviteUrl,
    refreshGroups,
    refreshAvailableGroups,
    shareExpenseToGroup,
    getGroup,
    computeGroupBalances,
    computeGroupDebts,
    disconnect,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSplitPay(): SplitPayContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSplitPay must be used within SplitPayProvider");
  return ctx;
}
