"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">AI</span>
            </div>
            <div className="absolute inset-0 w-12 h-12 rounded-xl border-2 border-accent/30 animate-ping" />
          </div>
          <p className="text-sm text-foreground/40 tracking-wide">Ładowanie platformy...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CommandPalette />
      <main className="pt-36 pb-32 sm:pt-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DashboardGuard>{children}</DashboardGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}
