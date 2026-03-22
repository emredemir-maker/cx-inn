import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAppAuth } from "@/context/auth-context";
import {
  Crown, UserCog, Users, Shield, ChevronDown, Loader2, Check,
  UserPlus, Mail, Trash2, Clock, UserCheck, SendHorizonal, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/hooks/use-firebase-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "") || "";

interface PlatformUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
  createdAt: string;
}

interface Invitation {
  id: number;
  email: string;
  role: UserRole;
  accepted: boolean;
  acceptedAt: string | null;
  createdAt: string;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  superadmin: {
    label: "Süper Admin",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    icon: Crown,
    desc: "Tüm sistem + kullanıcı yönetimi",
  },
  cx_manager: {
    label: "CX Manager",
    color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
    icon: Shield,
    desc: "Anket & kampanya + onay yetkisi",
  },
  cx_user: {
    label: "CX Kullanıcısı",
    color: "bg-slate-500/15 text-slate-400 border-slate-500/25",
    icon: Users,
    desc: "İçerik oluşturma; execute için onay gerekir",
  },
};

const ROLE_ORDER: UserRole[] = ["superadmin", "cx_manager", "cx_user"];

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border", cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function RoleDropdown({
  userId,
  currentRole,
  selfId,
}: {
  userId: string;
  currentRole: UserRole;
  selfId: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const isSelf = userId === selfId;

  const mutation = useMutation({
    mutationFn: async (role: UserRole) => {
      const res = await fetch(`${BASE}/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
      setOpen(false);
    },
    onError: (err) => alert((err as Error).message),
  });

  if (isSelf) return <RoleBadge role={currentRole} />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={mutation.isPending}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-white/5 text-xs text-slate-300 transition-all"
      >
        {mutation.isPending
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <RoleBadge role={currentRole} />
        }
        <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-60 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {ROLE_ORDER.map((role) => {
              const cfg = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const isSelected = role === currentRole;
              return (
                <button
                  key={role}
                  onClick={() => mutation.mutate(role)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors",
                    isSelected && "bg-white/[0.03]",
                  )}
                >
                  <div className={cn("mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center border shrink-0", cfg.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{cfg.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{cfg.desc}</p>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tenant Admin invite form (uses /platform/my-tenant/invite) ────────────────
function TenantInviteForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"cx_manager" | "cx_user">("cx_user");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/platform/my-tenant/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      setEmail("");
      setRole("cx_user");
      onSuccess();
    },
    onError: (err) => alert((err as Error).message),
  });

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Kullanıcı Davet Et</h3>
          <p className="text-xs text-slate-500">Davet edilen kişi Google ile giriş yaptığında firmaya eklenir</p>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kullanici@firma.com"
            type="email"
            className="w-full h-10 pl-9 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "cx_manager" | "cx_user")}
          className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none"
        >
          <option value="cx_user">CX Kullanıcısı</option>
          <option value="cx_manager">CX Manager</option>
        </select>
        <button
          onClick={() => email.trim() && mutation.mutate()}
          disabled={!email.trim() || mutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {mutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <SendHorizonal className="w-4 h-4" />}
          Davet Et
        </button>
      </div>
    </div>
  );
}

function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("cx_user");
  const [lastResult, setLastResult] = useState<{ type: "success" | "warn"; msg: string } | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
      return res.json() as Promise<{ emailSent: boolean; emailError?: string }>;
    },
    onSuccess: (data) => {
      setEmail("");
      setRole("cx_user");
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      if (data.emailSent) {
        setLastResult({ type: "success", msg: "Davet e-postası gönderildi ✓" });
      } else {
        setLastResult({ type: "warn", msg: `Davet kaydedildi, ancak e-posta gönderilemedi: ${data.emailError ?? "bilinmeyen hata"}` });
      }
      setTimeout(() => setLastResult(null), 6000);
    },
    onError: (err) => alert((err as Error).message),
  });

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Kullanıcı Davet Et</h3>
          <p className="text-xs text-slate-500">Davet edilen kişi Google ile giriş yaptığında rol otomatik atanır</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kullanici@firma.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && email && mutation.mutate()}
          />
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
          ))}
        </select>

        <button
          onClick={() => mutation.mutate()}
          disabled={!email.trim() || mutation.isPending}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
            "bg-indigo-600 hover:bg-indigo-500 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Davet Et
        </button>
      </div>

      {lastResult && (
        <div className={cn(
          "mt-4 flex items-start gap-3 px-4 py-3 rounded-xl text-sm border",
          lastResult.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
            : "bg-amber-500/10 border-amber-500/25 text-amber-400",
        )}>
          {lastResult.type === "success"
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{lastResult.msg}</span>
        </div>
      )}
    </div>
  );
}

interface TenantMember {
  membershipId: number;
  userId: string;
  role: string;
  joinedAt: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export default function UserManagementPage() {
  const { user: me, currentTenantRole } = useAppAuth();
  const queryClient = useQueryClient();

  const isSuperadmin = me?.role === "superadmin";
  const isTenantAdmin = currentTenantRole === "tenant_admin";
  const canAccess = isSuperadmin || isTenantAdmin;

  const { data: users = [], isLoading: usersLoading } = useQuery<PlatformUser[]>({
    queryKey: ["platform-users"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Kullanıcılar yüklenemedi");
      return res.json();
    },
    enabled: isSuperadmin,
  });

  // Tenant admin: load members via tenant API
  const { data: tenantMembers = [], isLoading: tenantMembersLoading } = useQuery<TenantMember[]>({
    queryKey: ["my-tenant-members"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/platform/my-tenant/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Üyeler yüklenemedi");
      const data = (await res.json()) as { members: TenantMember[] };
      return data.members;
    },
    enabled: isTenantAdmin && !isSuperadmin,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["invitations"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/invitations`, { credentials: "include" });
      if (!res.ok) throw new Error("Davetler yüklenemedi");
      return res.json();
    },
    enabled: isSuperadmin,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`${BASE}/api/platform/my-tenant/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Üye kaldırılamadı");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-tenant-members"] }),
    onError: (err) => alert((err as Error).message),
  });

  const deleteInvitation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}/api/invitations/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });

  const [resendStates, setResendStates] = useState<Record<number, "idle" | "loading" | "done" | "error">>({});
  const resendInvitation = async (id: number) => {
    setResendStates((s) => ({ ...s, [id]: "loading" }));
    try {
      const res = await fetch(`${BASE}/api/invitations/${id}/resend`, {
        method: "POST",
        credentials: "include",
      });
      setResendStates((s) => ({ ...s, [id]: res.ok ? "done" : "error" }));
      setTimeout(() => setResendStates((s) => ({ ...s, [id]: "idle" })), 3000);
    } catch {
      setResendStates((s) => ({ ...s, [id]: "error" }));
      setTimeout(() => setResendStates((s) => ({ ...s, [id]: "idle" })), 3000);
    }
  };

  if (!canAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Crown className="w-12 h-12 text-amber-500/40 mx-auto mb-4" />
            <p className="text-slate-400">Bu sayfaya erişim yetkiniz yok.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Tenant Admin View ──────────────────────────────────────────────────────
  if (isTenantAdmin && !isSuperadmin) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <UserCog className="w-4 h-4 text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
              </div>
              <p className="text-slate-400 text-sm ml-11">
                Firmanızdaki kullanıcıları yönetin — yeni kullanıcı davet edin, gerektiğinde kaldırın.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-xs font-semibold text-indigo-400">
              <Users className="w-3.5 h-3.5" />
              {tenantMembers.length} üye
            </div>
          </div>

          {/* Tenant Invite Form */}
          <TenantInviteForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["my-tenant-members"] })} />

          {/* Members list */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                Üyeler
                <span className="ml-2 text-xs text-slate-500 font-normal">({tenantMembers.length})</span>
              </h2>
            </div>

            {tenantMembersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 w-5 animate-spin text-indigo-400" />
              </div>
            ) : tenantMembers.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">Henüz üye yok.</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {tenantMembers.map((member) => {
                  const displayName =
                    [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || "—";
                  const initials = displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                  const isSelf = member.userId === me?.id;
                  const ROLE_LABELS: Record<string, string> = {
                    tenant_admin: "Tenant Admin",
                    cx_manager: "CX Manager",
                    cx_user: "CX Kullanıcısı",
                  };
                  return (
                    <div key={member.userId} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                      {member.profileImageUrl ? (
                        <img src={member.profileImageUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white ring-2 ring-slate-700 flex-shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 flex-shrink-0">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {!isSelf && (
                        <button
                          onClick={() => {
                            if (confirm(`${displayName} kullanıcısını firmadan kaldırmak istediğinize emin misiniz?`)) {
                              removeMemberMutation.mutate(member.userId);
                            }
                          }}
                          disabled={removeMemberMutation.isPending}
                          title="Üyeyi kaldır"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  const pendingInvitations = invitations.filter((i) => !i.accepted);
  const acceptedInvitations = invitations.filter((i) => i.accepted);
  const roleCounts = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = users.filter((u) => u.role === role).length;
    return acc;
  }, {} as Record<UserRole, number>);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <UserCog className="w-4 h-4 text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
            </div>
            <p className="text-slate-400 text-sm ml-11">Kullanıcıları davet edin, rollerini ve yetkilerini yönetin</p>
          </div>

          {/* Role summary pills */}
          <div className="flex gap-2">
            {ROLE_ORDER.map((role) => {
              const cfg = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              return (
                <div key={role} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold", cfg.color)}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{roleCounts[role]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invite form */}
        <InviteForm />

        {/* Active users */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                Aktif Kullanıcılar
                <span className="ml-2 text-xs text-slate-500 font-normal">({users.length})</span>
              </h2>
            </div>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">Henüz kullanıcı yok.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {users.map((user) => {
                const displayName =
                  [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "—";
                const initials = displayName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const joinDate = new Date(user.createdAt).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                        {initials || "?"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email ?? "—"}</p>
                    </div>

                    <div className="text-xs text-slate-600 hidden lg:block shrink-0">{joinDate}</div>

                    {me && (
                      <RoleDropdown userId={user.id} currentRole={user.role} selfId={me.id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending invitations */}
        {(pendingInvitations.length > 0 || invitationsLoading) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">
                  Bekleyen Davetler
                  <span className="ml-2 text-xs text-slate-500 font-normal">({pendingInvitations.length})</span>
                </h2>
              </div>
            </div>

            {invitationsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {pendingInvitations.map((inv) => {
                  const rs = resendStates[inv.id] ?? "idle";
                  return (
                    <div key={inv.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-amber-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{inv.email}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(inv.createdAt).toLocaleDateString("tr-TR")} tarihinde davet edildi
                        </p>
                      </div>

                      <RoleBadge role={inv.role} />

                      {/* Resend button */}
                      <button
                        onClick={() => resendInvitation(inv.id)}
                        disabled={rs === "loading" || rs === "done"}
                        title="E-postayı yeniden gönder"
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                          rs === "done"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
                            : rs === "error"
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : "border-slate-700 text-slate-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {rs === "loading" && <Loader2 className="w-3 h-3 animate-spin" />}
                        {rs === "done" && <CheckCircle2 className="w-3 h-3" />}
                        {rs === "error" && <AlertCircle className="w-3 h-3" />}
                        {rs === "idle" && <SendHorizonal className="w-3 h-3" />}
                        {rs === "done" ? "Gönderildi" : rs === "error" ? "Hata" : "Tekrar Gönder"}
                      </button>

                      <button
                        onClick={() => deleteInvitation.mutate(inv.id)}
                        disabled={deleteInvitation.isPending}
                        title="Daveti iptal et"
                        className="p-2 rounded-lg hover:bg-red-500/15 text-slate-600 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Accepted invitations (collapsed) */}
        {acceptedInvitations.length > 0 && (
          <div className="rounded-2xl border border-slate-800/50 overflow-hidden opacity-60">
            <div className="px-6 py-3 border-b border-slate-800/50">
              <h2 className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Kabul Edilen Davetler ({acceptedInvitations.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              {acceptedInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/8 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 truncate">{inv.email}</p>
                  </div>
                  <RoleBadge role={inv.role} />
                  <span className="text-[10px] text-slate-700">
                    {inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleDateString("tr-TR") : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
