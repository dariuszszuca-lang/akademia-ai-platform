import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin — Akademia AI",
  description: "Panel administracyjny",
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
