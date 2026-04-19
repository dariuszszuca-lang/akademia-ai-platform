import { redirect } from "next/navigation";
import { isAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { kvStatus } from "@/lib/module-overrides";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  if (!isAdminConfigured()) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-[2rem] border border-border bg-[color:var(--card)] p-8">
          <p className="eyebrow">Admin</p>
          <h1 className="mt-3 font-display text-3xl text-foreground">Admin nie jest skonfigurowany</h1>
          <p className="mt-4 text-sm leading-6 text-foreground/65">
            Ustaw zmienne środowiskowe w Vercel (lub lokalnie w <code>.env.local</code>):
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-background/70 p-4 text-xs text-foreground/80">
{`ADMIN_PASSWORD=twoje-tajne-haslo
# opcjonalnie — wygenerowane automatycznie po włączeniu Vercel KV:
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...`}
          </pre>
          <p className="mt-4 text-xs text-foreground/50">
            Vercel KV włączysz jednym klikiem w dashboardzie projektu → Storage → Create Database → KV.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    redirect("/admin/login");
  }

  return <AdminDashboard kv={kvStatus()} />;
}
