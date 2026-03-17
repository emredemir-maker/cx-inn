import React from "react";
import { Link, useLocation } from "wouter";
import { NlpQueryPanel } from "./nlp-query";
import { useAppAuth } from "@/context/auth-context";
import { LogOut } from "lucide-react";
import {
  LayoutDashboard,
  MessageSquareQuote,
  Users,
  BrainCircuit,
  ShieldCheck,
  PieChart,
  Bell,
  Search,
  MessagesSquare,
  Send,
  Building2,
  BarChart2,
  Zap,
  Settings,
  UserCog,
  ClipboardCheck,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/hooks/use-firebase-auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Süper Admin",
  cx_manager: "CX Manager",
  cx_user: "CX Kullanıcısı",
};

const ROLE_COLORS: Record<UserRole, string> = {
  superadmin: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  cx_manager: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
  cx_user: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Genel Bakış",
    items: [
      { href: "/", label: "Gösterge Paneli", icon: LayoutDashboard },
      { href: "/analytics", label: "CX Analiz Raporu", icon: BarChart2 },
      { href: "/customers", label: "Müşteriler", icon: Users },
      { href: "/companies", label: "Firmalar", icon: Building2 },
      { href: "/segments", label: "Segmentler", icon: PieChart },
    ],
  },
  {
    label: "Veri Toplama",
    items: [
      { href: "/interactions", label: "Etkileşim Kayıtları", icon: MessagesSquare },
      { href: "/anomalies", label: "Sıfır Anket Motoru", icon: Zap },
    ],
  },
  {
    label: "Anket & İletişim",
    items: [
      { href: "/surveys", label: "Anket Şablonları", icon: MessageSquareQuote },
      { href: "/campaigns", label: "Kampanya Yönetimi", icon: Send },
    ],
  },
  {
    label: "Yönetim",
    items: [
      {
        href: "/approvals",
        label: "Onay Kuyruğu",
        icon: ClipboardCheck,
        roles: ["superadmin", "cx_manager"],
      },
      { href: "/audit-logs", label: "Denetim Kaydı", icon: ShieldCheck },
      { href: "/settings", label: "Hesap Ayarları", icon: Settings },
    ],
  },
  {
    label: "Süper Admin",
    items: [
      {
        href: "/user-management",
        label: "Kullanıcı Yönetimi",
        icon: UserCog,
        roles: ["superadmin"],
      },
    ],
  },
];

function UserSection() {
  const { user, logout } = useAppAuth();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Kullanıcı"
    : "Kullanıcı";
  const initials = displayName
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const role = user?.role;

  return (
    <div className="p-4 border-t border-border/50 space-y-3">
      {role && (
        <div className="flex justify-center">
          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5", ROLE_COLORS[role])}>
            {role === "superadmin" && <Crown className="w-2.5 h-2.5" />}
            {ROLE_LABELS[role]}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 p-2 rounded-xl group">
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white text-xs font-bold shadow-lg flex-shrink-0">
            {initials || <ShieldCheck className="h-4 w-4" />}
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</span>
        </div>
        <button
          onClick={logout}
          title="Çıkış Yap"
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-all"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAppAuth();
  const userRole = user?.role as UserRole | undefined;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border/50 bg-card/30 backdrop-blur-xl flex flex-col z-20 relative shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <div className="flex items-center gap-2 text-primary">
            <BrainCircuit className="h-6 w-6" />
            <span className="font-display font-bold text-lg text-foreground tracking-wide">
              CX<span className="text-primary">-Inn</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || (userRole && item.roles.includes(userRole)),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label}>
                <div className="px-3 mb-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      location === item.href ||
                      (item.href !== "/" && location.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                          isActive
                            ? "text-primary bg-primary/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                        )}
                        <div className="flex items-center gap-3">
                          <Icon
                            className={cn(
                              "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                              isActive && "drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]",
                            )}
                          />
                          <span className="font-medium text-sm">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <UserSection />
      </aside>

      {/* NLP Query Panel (global floating button + slide-over) */}
      <NlpQueryPanel />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 z-10 relative">
        {/* Topbar */}
        <header className="h-16 flex-shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-8 z-30">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Müşteri veya kayıt ara..."
              className="w-full bg-card/50 border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-inner"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
