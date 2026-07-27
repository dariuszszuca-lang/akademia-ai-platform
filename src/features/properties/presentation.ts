import type {
  PropertyFact,
  PropertyFactStatus,
  PropertyProject,
  PropertyStage,
} from './domain'

const propertyTypeLabels: Record<PropertyProject['propertyType'], string> = {
  apartment: 'Mieszkanie',
  house: 'Dom',
  plot: 'Działka',
  commercial: 'Obiekt komercyjny',
  premises: 'Lokal',
  other: 'Inna nieruchomość',
}

const transactionTypeLabels: Record<
  PropertyProject['transactionType'],
  string
> = {
  sale: 'Sprzedaż',
  rent: 'Najem',
}

const propertyStageLabels: Record<PropertyStage, string> = {
  draft: 'Szkic',
  collecting: 'Zbieranie danych',
  verification: 'Weryfikacja',
  ready: 'Gotowe',
  marketing: 'W promocji',
  under_offer: 'W negocjacjach',
  closed: 'Zamknięte',
  archived: 'Archiwum',
}

const factStatusPresentation: Record<
  PropertyFactStatus,
  { label: string; symbol: string; tone: string }
> = {
  confirmed: {
    label: 'Potwierdzone',
    symbol: '✓',
    tone: 'success',
  },
  declared: {
    label: 'Z deklaracji',
    symbol: 'D',
    tone: 'info',
  },
  inferred: {
    label: 'Wniosek AI',
    symbol: 'AI',
    tone: 'ai',
  },
  conflicting: {
    label: 'Konflikt',
    symbol: '!',
    tone: 'danger',
  },
  missing: {
    label: 'Brak danych',
    symbol: '—',
    tone: 'warning',
  },
  not_applicable: {
    label: 'Nie dotyczy',
    symbol: '×',
    tone: 'neutral',
  },
}

const factVisibilityLabels: Record<PropertyFact['visibility'], string> = {
  internal: 'Wewnętrzne',
  client: 'Dla klienta',
  public: 'Publiczne',
}

const factCategoryLabels: Record<string, string> = {
  areas: 'Powierzchnie',
  address: 'Lokalizacja',
  building: 'Budynek',
  costs: 'Koszty',
  legal: 'Stan prawny',
  plot: 'Działka',
  price: 'Cena',
  rooms: 'Pomieszczenia',
  technical: 'Dane techniczne',
  other: 'Pozostałe',
}

export function getPropertyTypeLabel(type: PropertyProject['propertyType']) {
  return propertyTypeLabels[type]
}

export function getTransactionTypeLabel(
  type: PropertyProject['transactionType'],
) {
  return transactionTypeLabels[type]
}

export function getPropertyStageLabel(stage: PropertyStage) {
  return propertyStageLabels[stage]
}

export function getFactStatusPresentation(status: PropertyFactStatus) {
  return factStatusPresentation[status]
}

export function getFactVisibilityLabel(visibility: PropertyFact['visibility']) {
  return factVisibilityLabels[visibility]
}

export function getFactCategoryLabel(category: string) {
  return factCategoryLabels[category] ?? category
}

export function getUnresolvedFacts(facts: PropertyFact[]) {
  return facts.filter(
    (fact) => fact.status === 'missing' || fact.status === 'conflicting',
  )
}

export function formatFactValue(
  value: unknown,
  valueType: PropertyFact['valueType'],
  unit?: string,
) {
  if (value === null || value === undefined || value === '') {
    return 'Brak wartości'
  }

  let formatted: string

  if (valueType === 'json') {
    formatted = JSON.stringify(value, null, 2)
  } else if (
    (valueType === 'number' || valueType === 'money') &&
    typeof value === 'number'
  ) {
    formatted = new Intl.NumberFormat('pl-PL', {
      maximumFractionDigits: 2,
    }).format(value)
  } else if (valueType === 'boolean') {
    formatted = value ? 'Tak' : 'Nie'
  } else if (valueType === 'date') {
    const date = new Date(String(value))
    formatted = Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('pl-PL').format(date)
  } else {
    formatted = String(value)
  }

  return unit ? `${formatted} ${unit}` : formatted
}
