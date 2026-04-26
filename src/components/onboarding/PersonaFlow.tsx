'use client'

import { useState } from 'react'
import type { PersonaQuestion } from '@/data/onboarding/persona-questions'
import PersonaPathSelector from './PersonaPathSelector'
import PersonaChat from './PersonaChat'
import PersonaPathA from './PersonaPathA'

type Props = {
  type: 'buyer' | 'seller'
  initialPath: 'A' | 'B' | null
  questions: PersonaQuestion[]
  initialAnswers: Record<string, string>
  resultPath: string
}

export default function PersonaFlow({
  type,
  initialPath,
  questions,
  initialAnswers,
  resultPath,
}: Props) {
  const [path, setPath] = useState<'A' | 'B' | null>(initialPath)

  if (!path) {
    return <PersonaPathSelector type={type} onChoose={setPath} />
  }

  if (path === 'A') {
    return <PersonaPathA type={type} resultPath={resultPath} />
  }

  return (
    <PersonaChat
      type={type}
      questions={questions}
      initialAnswers={initialAnswers}
      resultPath={resultPath}
    />
  )
}
