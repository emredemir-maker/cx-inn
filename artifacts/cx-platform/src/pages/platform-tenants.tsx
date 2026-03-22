import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAppAuth } from "@/context/auth-context";
import {
  Building2,
  Plus,
  Settings,
  Users,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Globe,
  Mail,
  Loader2,
  CheckCircle2,
  XCircle,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  industry: string | null;
  description: string | null;
  email: string | null;
  website: string | null;
  plan: "standard" | "professional" | "enterprise";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  membershipId: number;
  userId: string;
  role: string;
  joinedAt: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "") || "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const PLAN_BADGE: Record<string, string> = {
  standard: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  professional: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  enterprise: "bg-amber-500/15 text-amber-400 border-amber-500/25",
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  professional: "Professional",
  enterprise: "Enterprise",
};

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Tenant Admin",
  cx_manager: "CX Manager",
  cx_user: "CX Kullanıcısı",
};

function MemberRow({
  member,
  tenantId,
  onRemove,
}: {
  member: Member;
  tenantId: string;
  onRemove: (userId: string) => void;
}) {
  const displayName =
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.email ||
    "Kullanıcı";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/3 group transition-colors">
      {member.profileImageUrl ? (
        <img
          src={member.profileImageUrl}
          alt={displayName}
          className="h-8 w-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 flex-shrink-0">
        {ROLE_LABELS[member.role] ?? member.role}
      </span>
      <button
        onClick={() => onRemove(member.userId)}
        title="Üyeyi kaldır"
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TenantCard({
  tenant,
  onUpdated,
}: {
  tenant: Tenant;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("cx_user");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["tenant-members", tenant.id],
    queryFn: () =>
      apiFetch<{ members: Member[] }>(`/api/platform/tenants/${tenant.id}/members`).then(
        (r) => r.members,
      ),
    enabled: expanded,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/platform/tenants/${tenant.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !tenant.isActive }),
      }),
    onSuccess: () => {
      toast({
        title: tenant.isActive ? "Tenant devre dışı bırakıldı" : "Tenant aktifleştirildi",
      });
      onUpdated();
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/platform/tenants/${tenant.id}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      }),
    onSuccess: () => {
      toast({ title: "Davet gönderildi", description: `${inviteEmail} adresine davet oluşturuldu` });
      setInviteEmail("");
      setShowInviteForm(false);
      queryClient.invalidateQueries({ queryKey: ["tenant-members", tenant.id] });
    },
    onError: (err: Error) => {
      toast({ title: "Davet gönderilemedi", description: err.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/platform/tenants/${tenant.id}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({ title: "Üye kaldırıldı" });
      queryClient.invalidateQueries({ queryKey: ["tenant-members", tenant.id] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div
      className={cn(
        "border rounded-2xl overflow-hidden transition-all",
        tenant.isActive ? "border-border bg-card/60" : "border-border/40 bg-card/20 opacity-70",
      )}
    >
      {/* Card header */}
      <div className="p-5 flex items-start gap-4">
        {/* Logo / initials */}
        <div
          className="h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.primaryColor}cc)`,
          }}
        >
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-full w-full object-contain rounded-xl"
            />
          ) : (
            tenant.name.slice(0, 2).toUpperCase()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-foreground">{tenant.name}</h3>
            <span className="text-xs text-muted-foreground font-mono bg-slate-800 px-1.5 py-0.5 rounded">
              {tenant.slug}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                PLAN_BADGE[tenant.plan],
              )}
            >
              {PLAN_LABELS[tenant.plan]}
            </span>
            {!tenant.isActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                Pasif
              </span>
            )}
          </div>
          {tenant.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
              {tenant.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {tenant.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {tenant.email}
              </span>
            )}
            {tenant.website && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {tenant.website}
              </span>
            )}
            {tenant.industry && <span>· {tenant.industry}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toggleActiveMutation.mutate()}
            disabled={toggleActiveMutation.isPending}
            title={tenant.isActive ? "Devre dışı bırak" : "Aktifleştir"}
            className={cn(
              "p-2 rounded-lg transition-colors text-sm",
              tenant.isActive
                ? "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                : "text-green-400 hover:bg-green-500/10",
            )}
          >
            {toggleActiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : tenant.isActive ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded: members + invite */}
      {expanded && (
        <div className="border-t border-border/50 px-5 pb-5 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Üyeler
              {membersQuery.data && (
                <span className="text-xs text-muted-foreground">
                  ({membersQuery.data.length})
                </span>
              )}
            </h4>
            <button
              onClick={() => setShowInviteForm((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Davet Et
            </button>
          </div>

          {/* Invite form */}
          {showInviteForm && (
            <div className="bg-slate-800/50 border border-border/50 rounded-xl p-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Yeni Davet
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="kullanici@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="cx_user">CX Kullanıcısı</option>
                  <option value="cx_manager">CX Manager</option>
                  <option value="tenant_admin">Tenant Admin</option>
                </select>
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Davet Et
                </button>
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-0.5">
            {membersQuery.isLoading && (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Üyeler yükleniyor...
              </div>
            )}
            {membersQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz üye yok. Davet ederek başlayın.
              </p>
            )}
            {membersQuery.data?.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                tenantId={tenant.id}
                onRemove={(userId) => removeMemberMutation.mutate(userId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Tenant Form ────────────────────────────────────────────────────────

function CreateTenantForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    email: "",
    website: "",
    industry: "",
    description: "",
    plan: "standard",
    primaryColor: "#6366f1",
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast({ title: "Tenant oluşturuldu", description: `${form.name} başarıyla oluşturuldu` });
      setForm({
        name: "",
        slug: "",
        email: "",
        website: "",
        industry: "",
        description: "",
        plan: "standard",
        primaryColor: "#6366f1",
      });
      onCreated();
    },
    onError: (err: Error) => {
      toast({ title: "Oluşturma hatası", description: err.message, variant: "destructive" });
    },
  });

  // Auto-generate slug from name
  function handleNameChange(value: string) {
    const autoSlug = value
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setForm((f) => ({ ...f, name: value, slug: autoSlug }));
  }

  const inputCls =
    "w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all";

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        Yeni Tenant Oluştur
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Firma Adı *
          </label>
          <input
            type="text"
            placeholder="Örn: Infoset Teknoloji"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Slug *
          </label>
          <input
            type="text"
            placeholder="infoset-teknoloji"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className={cn(inputCls, "font-mono")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            E-posta
          </label>
          <input
            type="email"
            placeholder="info@firma.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Website
          </label>
          <input
            type="text"
            placeholder="https://firma.com"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sektör
          </label>
          <input
            type="text"
            placeholder="Teknoloji, Perakende..."
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Plan
          </label>
          <select
            value={form.plan}
            onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
            className={inputCls}
          >
            <option value="standard">Standard</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Açıklama
        </label>
        <textarea
          placeholder="Firma hakkında kısa bir açıklama..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className={cn(inputCls, "resize-none")}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Marka Rengi
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              className="h-8 w-8 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-muted-foreground">{form.primaryColor}</span>
          </div>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.name.trim() || !form.slug.trim() || mutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Tenant Oluştur
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlatformTenantsPage() {
  const { user } = useAppAuth();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  // Access guard — superadmin only
  if (user && user.role !== "superadmin") {
    navigate("/");
    return null;
  }

  const tenantsQuery = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: () =>
      apiFetch<{ tenants: Tenant[] }>("/api/platform/tenants").then((r) => r.tenants),
  });

  const activeTenants = tenantsQuery.data?.filter((t) => t.isActive) ?? [];
  const inactiveTenants = tenantsQuery.data?.filter((t) => !t.isActive) ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              Platform Yönetimi
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Tüm tenant hesaplarını yönetin, yeni hesap oluşturun ve kullanıcı davetleri gönderin.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Yeni Tenant
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Toplam Tenant",
              value: tenantsQuery.data?.length ?? 0,
              icon: Building2,
              color: "text-indigo-400",
              bg: "bg-indigo-500/10",
            },
            {
              label: "Aktif",
              value: activeTenants.length,
              icon: CheckCircle2,
              color: "text-green-400",
              bg: "bg-green-500/10",
            },
            {
              label: "Pasif",
              value: inactiveTenants.length,
              icon: XCircle,
              color: "text-red-400",
              bg: "bg-red-500/10",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
            >
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <CreateTenantForm
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
              setShowCreate(false);
            }}
          />
        )}

        {/* Loading */}
        {tenantsQuery.isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Tenant listesi yükleniyor...
          </div>
        )}

        {/* Active tenants */}
        {activeTenants.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
              Aktif Tenantlar ({activeTenants.length})
            </h2>
            {activeTenants.map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                onUpdated={() =>
                  queryClient.invalidateQueries({ queryKey: ["platform-tenants"] })
                }
              />
            ))}
          </div>
        )}

        {/* Inactive tenants */}
        {inactiveTenants.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
              Pasif Tenantlar ({inactiveTenants.length})
            </h2>
            {inactiveTenants.map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                onUpdated={() =>
                  queryClient.invalidateQueries({ queryKey: ["platform-tenants"] })
                }
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!tenantsQuery.isLoading && tenantsQuery.data?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary/60" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Henüz tenant yok</p>
              <p className="text-sm text-muted-foreground mt-1">
                İlk tenant'ı oluşturmak için "Yeni Tenant" butonuna tıklayın.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              İlk Tenant'ı Oluştur
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
