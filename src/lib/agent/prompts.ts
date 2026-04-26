import type { Agent, AgentTool } from '@/data/agents'
import { userContextAsBlock, type UserContext } from './user-context'

/**
 * Buduje system prompt dla agenta na bazie:
 * - tozsamosci agenta (CEO/Marketing/Prawny/Wycena/Publikacja)
 * - kontekstu uzytkownika (profil + persony)
 * - wybranego narzedzia (tool template)
 */
export function buildAgentSystemPrompt(
  agent: Agent,
  userContext: UserContext,
): string {
  return `Jesteś agentem "${agent.name}" na platformie Akademia AI dla agentów nieruchomości.

ROLA: ${agent.tagline}
${agent.description}

KONTEKST UŻYTKOWNIKA (zawsze uwzględniaj te dane przy każdej odpowiedzi):

${userContextAsBlock(userContext)}

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
