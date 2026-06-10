import { createClient } from "@supabase/supabase-js";
import type { GroupMember } from "./bridge";
import { normalizeWallet } from "./utils";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = url && key ? createClient(url, key) : null;

// ---------- Groups ----------

export async function publishGroup(group: { id: string; name: string; avatar: string; inviteCode: string }): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("groups").upsert(
      { id: group.id, name: group.name, avatar: group.avatar, invite_code: group.inviteCode },
      { onConflict: "id" }
    );
  } catch {}
}

export async function fetchGroups(walletAddress: string): Promise<{ id: string; name: string; avatar: string; inviteCode: string }[]> {
  if (!supabase) return [];
  try {
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .ilike("wallet_address", walletAddress);
    if (!memberships?.length) return [];
    const groupIds = memberships.map((m: any) => m.group_id);
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, avatar, invite_code")
      .in("id", groupIds);
    const found = groups ?? [];
    const foundIds = new Set(found.map((g: any) => g.id));

    // Repair: upsert stub rows for any group_id that has no groups entry
    const missingIds = groupIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      const stubs = missingIds.map((id) => ({ id, name: id, avatar: "", invite_code: "" }));
      await supabase.from("groups").upsert(stubs, { onConflict: "id" });
      stubs.forEach((s) => found.push(s));
    }

    return found.map((g: any) => ({
      id: g.id,
      name: g.name ?? g.id,
      avatar: g.avatar ?? "",
      inviteCode: g.invite_code ?? "",
    }));
  } catch { return []; }
}

export async function fetchGroupById(groupId: string): Promise<{ id: string; name: string; avatar: string; inviteCode: string } | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("groups")
      .select("id, name, avatar, invite_code")
      .eq("id", groupId)
      .single();
    if (!data) return null;
    return { id: data.id, name: data.name, avatar: data.avatar ?? "", inviteCode: data.invite_code ?? "" };
  } catch { return null; }
}

// ---------- Members ----------

export async function publishMember(groupId: string, member: GroupMember): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("group_members").upsert(
      {
        group_id: groupId,
        wallet_address: normalizeWallet(member.walletAddress),
        display_name: member.displayName ?? "",
        avatar: member.avatar ?? "",
        roles: member.roles ?? [],
      },
      { onConflict: "group_id,wallet_address" }
    );
  } catch {}
}

export async function fetchMembers(groupId: string): Promise<GroupMember[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("group_members")
      .select("wallet_address, display_name, avatar, roles")
      .eq("group_id", groupId);
    return (data ?? []).map((r) => ({
      walletAddress: normalizeWallet(r.wallet_address),
      displayName: r.display_name,
      avatar: r.avatar,
      roles: r.roles,
    }));
  } catch { return []; }
}

// ---------- Expenses ----------

export async function publishExpense(expense: Record<string, any>): Promise<void> {
  if (!supabase) return;
  try {
    const normalized: Record<string, any> = {
      ...expense,
      paidBy: expense.paidBy ? normalizeWallet(expense.paidBy) : expense.paidBy,
      splits: Array.isArray(expense.splits)
        ? expense.splits.map((s: any) => ({ ...s, wallet: s.wallet ? normalizeWallet(s.wallet) : s.wallet }))
        : expense.splits,
    };
    await supabase.from("group_expenses").upsert({
      id: normalized.id,
      group_id: normalized.groupId,
      data: normalized,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function deleteExpenseRemote(expenseId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("group_expenses").delete().eq("id", expenseId);
  } catch {}
}

export async function fetchExpenses(groupId: string): Promise<Record<string, any>[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("group_expenses")
      .select("data")
      .eq("group_id", groupId);
    return (data ?? []).map((r) => {
      const e = r.data;
      if (!e) return e;
      return {
        ...e,
        paidBy: e.paidBy ? normalizeWallet(e.paidBy) : e.paidBy,
        splits: Array.isArray(e.splits)
          ? e.splits.map((s: any) => ({ ...s, wallet: s.wallet ? normalizeWallet(s.wallet) : s.wallet }))
          : e.splits,
      };
    });
  } catch { return []; }
}
