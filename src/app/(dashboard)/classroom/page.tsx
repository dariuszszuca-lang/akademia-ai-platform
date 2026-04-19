import { redirect } from "next/navigation";
import { getEffectiveModules } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

export default async function ClassroomPage() {
  const all = await getEffectiveModules();
  const firstEnabled = all.find((m) => m.enabled && (m.items?.length ?? 0) > 0);

  if (firstEnabled && firstEnabled.items && firstEnabled.items[0]) {
    redirect(`/classroom/${firstEnabled.id}?lesson=${firstEnabled.items[0].id}`);
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="eyebrow">Warsztaty</p>
      <h1 className="mt-4 font-display text-3xl text-foreground">
        Moduły wkrótce
      </h1>
      <p className="mt-3 text-sm leading-6 text-foreground/60">
        Prowadzący odblokuje pierwszy moduł w odpowiednim momencie. Jeśli czekasz na warsztaty — sprawdź mail z zaproszeniem.
      </p>
    </div>
  );
}
