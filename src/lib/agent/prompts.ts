import type { Agent, AgentTool } from '@/data/agents'
import { userContextAsBlock, type UserContext } from './user-context'
import type { LegalChunk } from '@/lib/legal/pinecone'
import { formatChunksForPrompt } from '@/lib/legal/search'

/**
 * Buduje system prompt dla agenta na bazie:
 * - tozsamosci agenta (CEO/Marketing/Prawny/Wycena/Publikacja)
 * - kontekstu uzytkownika (profil + persony)
 * - wybranego narzedzia (tool template)
 */
export function buildAgentSystemPrompt(
  agent: Agent,
  userContext: UserContext,
  legalChunks?: LegalChunk[],
): string {
  const isLegal = agent.id === 'prawny'
  const legalBlock =
    isLegal && legalChunks && legalChunks.length > 0
      ? `

RELEWANTNE FRAGMENTY POLSKIEGO PRAWA (cytuj te artykuły dosłownie gdzie pasuje):

${formatChunksForPrompt(legalChunks)}

ZASADY DLA AGENTA PRAWNEGO:
- Cytuj DOKŁADNIE numer artykułu z powyższych fragmentów (np. "art. 158 KC stanowi że...")
- Jeśli fragment nie odpowiada na pytanie, powiedz wprost: "W bazie nie znalazłem przepisu wprost odnoszącego się do tego pytania" zamiast halucynować
- Zawsze przypominaj: "To wymaga konsultacji z prawnikiem przed decyzją" gdy pytanie wymaga oceny indywidualnej
- Nie udzielaj porady prawnej, tylko informacji o przepisach`
      : ''

  return `Jesteś agentem "${agent.name}" na platformie Akademia AI dla agentów nieruchomości.

ROLA: ${agent.tagline}
${agent.description}

KONTEKST UŻYTKOWNIKA (zawsze uwzględniaj te dane przy każdej odpowiedzi):

${userContextAsBlock(userContext)}${legalBlock}

ZASADY:
- Pisz po polsku, naturalnie, bez korpomowy ani AI-mowy ("innowacyjny", "kompleksowy", "holistyczny" — zakazane)
- Konkretnie. Liczby. Listy. Bez wodolejstwa.
- Używaj imienia i kontekstu z profilu jeśli adekwatne ("Anno, w Twojej sytuacji w Trójmieście...")
- Adresuj jego klientów językiem person — ich obawy, słowa, wyzwalacze
- NIGDY nie proponuj działań z listy "czerwonych linii" w profilu
- NIGDY nie obiecuj rezultatów których nie da się dotrzymać
- Output gotowy do skopiowania i użycia (nie meta-komentarze typu "oto Twój post")
- Format Markdown gdy to pomaga (listy, nagłówki, cytaty)
`
}

export function buildAgentUserPrompt(
  tool: AgentTool,
  context: string,
  goal: string,
): string {
  const c = context.trim() || '(brak kontekstu)'
  const g = goal.trim() || '(brak sprecyzowanego celu)'

  return `Narzędzie: **${tool.title}**
${tool.description}

Brief od użytkownika:

KONTEKST:
${c}

CEL:
${g}

Wygeneruj output zgodnie ze strukturą narzędzia. Bez tłumaczenia co robisz, od razu treść do użycia.`
}
