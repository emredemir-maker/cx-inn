import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function Card({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={cn("glass-panel rounded-2xl relative overflow-hidden group", className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string, description?: string, children?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

export function StatusBadge({ status, variant = "default" }: { status: string, variant?: "default" | "success" | "warning" | "destructive" | "primary" | "outline" }) {
  const variants = {
    default: "bg-muted text-muted-foreground border-transparent",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    primary: "bg-primary/10 text-primary border-primary/20",
    outline: "bg-transparent text-foreground border-border",
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", variants[variant])}>
      {status}
    </span>
  );
}

export function Button({ 
  children, variant = "primary", className, isLoading, ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive", isLoading?: boolean }) {
  
  const baseClass = "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background";
  
  const variants = {
    primary: "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 hover:bg-primary/90 focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary",
    outline: "border border-border bg-transparent hover:bg-white/5 focus:ring-border",
    ghost: "bg-transparent hover:bg-white/5 focus:ring-border",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive shadow-[0_0_15px_rgba(225,29,72,0.3)]",
  };

  return (
    <button className={cn(baseClass, variants[variant], className)} disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className={cn(
        "w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all",
        className
      )} 
      {...props} 
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select 
      className={cn(
        "w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none",
        className
      )} 
      {...props} 
    >
      {children}
    </select>
  );
}

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-medium text-foreground mb-1.5", className)} {...props}>
      {children}
    </label>
  );
}

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg glass-panel rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-display font-bold mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Veriler yükleniyor...</p>
      </div>
    </div>
  );
}
