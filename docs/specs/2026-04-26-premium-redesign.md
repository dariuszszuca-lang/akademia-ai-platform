# Premium Redesign + Faza 6 polish

Data: 2026-04-26
Stan: Implementacja

## Wizja: „Czarna porcelana"

Linear precision + Granola warmth + Apple materiality. Premium dark z surgical precision UX, ciepłą typografią (display serif), delikatną głębią materiałową.

## Decyzje

### Paleta
- Background: warstwowy `#08080a` z subtelnymi radial gradientami w hero
- Foreground: ciepły cream `#fdf9f0`
- Accent: skala teal `#1e4e53` od 50 do 900
- Status: emerald, amber, red w warm tones

### Typografia
- **Display (H1, H2, hero)**: Fraunces Variable (warm serif)
- **UI**: Geist Sans (już mamy)
- **Mono**: Geist Mono

### Motion
- `cubic-bezier(0.16, 1, 0.3, 1)` (Apple curve)
- 220ms mikrointerakcje, 460ms page transitions
- Stagger w listach

### Materiałowość
- Glass cards: `backdrop-blur(12px)` + border `1px white/8%` + premium shadows
- Brak scale na hover, tylko subtle border opacity + shadow growth
- Editorial spacing (większe paddingi)

### Cmd+K Command Palette
- Pełnoekranowy z `backdrop-blur(20px)`
- Fuzzy search: agenci, narzędzia, pliki, akcje
- Keyboard nav, Esc zamyka
- Recent actions

## Plan realizacji

**Faza A — Design system fundament**
- Update `globals.css` (paleta scale, typography, motion vars)
- Add Fraunces font w `layout.tsx`
- Refactor głównych komponentów

**Faza B — Cmd+K + Nav**
- `<CmdK>` component (cmdk lib)
- Minimalistyczna nawigacja z hint Cmd+K
- Keyboard shortcuts

**Faza C — Per-section polish**
- `/start` editorial hero
- `/agent/[id]` IDE-grade workspace
- `/onboarding` motion choreography
- `/profil` magazine-style viewer

**Faza 6 (równolegle z C)**
- Regenerate buttons na result pages
- UI badges dla źródeł prawnych (klikalne art. KC)
- PDF export profilu
- Mobile polish (chat input)
- Reset onboarding (admin)

## Funkcjonalności do zachowania
WSZYSTKIE z dotychczas zbudowanych:
- Express Wizard (15 pyt → profil.md)
- Persona Chat Path A i B (buyer + seller)
- Deep Wizard (20 pyt → rozszerzony profil)
- 6 agentów z real LLM + RAG dla prawnego
- /profil z tabami
- OnboardingCard na /start

Żadne istniejące endpointy ani dane nie znikają.
