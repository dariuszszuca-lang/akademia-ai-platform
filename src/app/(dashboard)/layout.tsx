"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import Navbar from "@/components/Navbar";

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
            <div className="w-12 h-12 flex items-center justify-center" style={{ borderLeft: "3px solid #C9A030" }}>
              <span className="text-foreground font-heading font-bold text-lg pl-2">AI</span>
            </div>
            <div className="absolute inset-0 w-12 h-12 border border-gold/30 animate-ping" />
          </div>
          <p className="text-sm text-foreground/40 tracking-[0.15em] uppercase font-light">Ładowanie platformy...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-14 pb-24">
        <div className="px-5 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto">
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
