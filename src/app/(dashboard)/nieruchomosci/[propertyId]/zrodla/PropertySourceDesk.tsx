'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ProposalDecision } from '@/features/property-sources/domain'
import {
  decidePropertyProposal,
  fetchPropertyProposals,
  fetchPropertySources,
  formatEvidenceLocator,
  formatSourceStatus,
  getPropertySourceDownload,
  parseCorrectedProposalValue,
  uploadPropertySource,
  type PropertyFactProposalWire,
  type PropertySourceWire,
} from '@/features/property-sources/client'

type PropertySourceDeskProps = {
  propertyId: string
  initialSources: PropertySourceWire[]
  initialProposals: PropertyFactProposalWire[]
}

type UploadState =
  | { status: 'idle' }
  | { status: 'working'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const activeSourceStatuses = new Set([
  'upload_pending',
  'uploaded',
  'scanning',
  'validating',
  'queued',
  'processing',
])

const statusToneClasses = {
  neutral: 'border-[#c8d0cc] bg-[#edf0ee] text-[#52615c]',
  working: 'border-[#86aaa5] bg-[#e2efed] text-[#255f5b]',
  success: 'border-[#8db29c] bg-[#e2eee6] text-[#2b6241]',
  warning: 'border-[#d5aa70] bg-[#f5e9d5] text-[#7a541f]',
  danger: 'border-[#cf9791] bg-[#f5e3e1] text-[#873f39]',
} as const

export default function PropertySourceDesk({
  propertyId,
  initialSources,
  initialProposals,
}: PropertySourceDeskProps) {
  const [sources, setSources] = useState(initialSources)
  const [proposals, setProposals] = useState(initialProposals)
  const [selectedSourceId, setSelectedSourceId] = useState(
    initialSources[0]?.id ?? null,
  )
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
  })
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null
  const selectedProposals = useMemo(
    () =>
      selectedSourceId
        ? proposals.filter(
            (proposal) => proposal.sourceId === selectedSourceId,
          )
        : [],
    [proposals, selectedSourceId],
  )
  const hasActiveSource = sources.some((source) =>
    activeSourceStatuses.has(source.status),
  )

  const refresh = useCallback(async () => {
    try {
      const [nextSources, nextProposals] = await Promise.all([
        fetchPropertySources(propertyId),
        fetchPropertyProposals(propertyId),
      ])
      setSources(nextSources)
      setProposals(nextProposals)
      setSelectedSourceId((current) =>
        current && nextSources.some((source) => source.id === current)
          ? current
          : (nextSources[0]?.id ?? null),
      )
      setRefreshError(null)
    } catch {
      setRefreshError(
        'Nie udało się odświeżyć stanu. Sprawdź połączenie i spróbuj ponownie.',
      )
    }
  }, [propertyId])

  useEffect(() => {
    if (!hasActiveSource) return
    const timer = window.setInterval(refresh, 4_000)
    return () => window.clearInterval(timer)
  }, [hasActiveSource, refresh])

  async function handleFile(file: File) {
    setUploadState({
      status: 'working',
      message: 'Liczenie sumy kontrolnej i przygotowanie wysyłki…',
    })
    try {
      const source = await uploadPropertySource({ propertyId, file })
      setSources((current) => [
        source,
        ...current.filter((item) => item.id !== source.id),
      ])
      setSelectedSourceId(source.id)
      setUploadState({
        status: 'success',
        message:
          'Plik wysłany. Teraz sprawdzamy go i przygotowujemy propozycje faktów.',
      })
      await refresh()
    } catch (error) {
      setUploadState({
        status: 'error',
        message: getUploadErrorMessage(error),
      })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#15252a] text-[#f7f2e7] shadow-[0_28px_80px_-50px_rgba(0,0,0,0.95)]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#d8b784]">
              Bezpieczne źródło prawdy
            </p>
            <h2 className="mt-2 font-display text-2xl tracking-[-0.02em] sm:text-3xl">
              {sources.length === 0
                ? 'Dodaj pierwsze źródło'
                : 'Dodaj kolejne źródło'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#aebdb8]">
              PDF, zdjęcie, DOCX, XLSX, CSV, tekst lub nagranie. Plik trafia do
              prywatnego magazynu, przechodzi kontrolę bezpieczeństwa, a AI
              niczego nie zatwierdzi bez Twojej decyzji.
            </p>
          </div>

          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[#f7f2e7] px-5 py-3 text-sm font-semibold text-[#162026] outline-none transition-transform hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-[#d8b784] focus-within:ring-offset-2 focus-within:ring-offset-[#15252a]">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,.txt,.mp3,.mp4,.wav,.webm"
              disabled={uploadState.status === 'working'}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            {uploadState.status === 'working'
              ? 'Przygotowuję plik…'
              : 'Wybierz plik'}
          </label>
        </div>

        {uploadState.status !== 'idle' ? (
          <div
            aria-live="polite"
            className={`border-t px-5 py-3 text-sm sm:px-6 ${
              uploadState.status === 'error'
                ? 'border-[#8d4f49]/40 bg-[#5b2c29]/30 text-[#f1c8c3]'
                : uploadState.status === 'success'
                  ? 'border-[#5c8f72]/30 bg-[#2d6244]/20 text-[#cce5d5]'
                  : 'border-[#79aaa4]/25 bg-[#2d6b68]/15 text-[#cce3df]'
            }`}
          >
            {uploadState.message}
          </div>
        ) : null}
      </section>

      {refreshError ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-[#cf9791] bg-[#f5e3e1] p-4 text-sm text-[#873f39] sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{refreshError}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="min-h-11 rounded-full border border-[#b66d65] px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#873f39]"
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : null}

      <div className="grid overflow-hidden rounded-[2.25rem] border border-[#d8d1c4] bg-[#f2ede3] text-[#162026] shadow-[0_30px_90px_-48px_rgba(0,0,0,0.75)] xl:min-h-[42rem] xl:grid-cols-[18rem_minmax(0,1fr)_minmax(22rem,0.92fr)]">
        <SourceList
          sources={sources}
          selectedSourceId={selectedSourceId}
          onSelect={setSelectedSourceId}
        />
        <SourcePreview propertyId={propertyId} source={selectedSource} />
        <ProposalPanel
          propertyId={propertyId}
          proposals={selectedProposals}
          onProposalUpdated={(proposal) =>
            setProposals((current) =>
              current.map((item) =>
                item.id === proposal.id ? proposal : item,
              ),
            )
          }
        />
      </div>
    </div>
  )
}

function SourceList({
  sources,
  selectedSourceId,
  onSelect,
}: {
  sources: PropertySourceWire[]
  selectedSourceId: string | null
  onSelect: (sourceId: string) => void
}) {
  return (
    <section className="border-b border-[#d8d1c4] bg-[#e8e2d7] p-4 xl:border-b-0 xl:border-r">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#8b693e]">
            Dokumenty i media
          </p>
          <h3 className="mt-1 font-display text-xl">Źródła</h3>
        </div>
        <span className="font-mono text-xs text-[#6f7975]">
          {String(sources.length).padStart(2, '0')}
        </span>
      </div>

      {sources.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#bbb2a5] bg-[#f7f3eb] p-4 text-sm leading-6 text-[#66716d]">
          Dodany plik pojawi się tutaj wraz z tekstowym statusem kontroli i
          analizy.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {sources.map((source) => {
            const status = formatSourceStatus(source.status)
            const selected = source.id === selectedSourceId
            return (
              <li key={source.id}>
                <button
                  type="button"
                  onClick={() => onSelect(source.id)}
                  aria-pressed={selected}
                  className={`w-full rounded-2xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2d6b68] ${
                    selected
                      ? 'border-[#2d6b68] bg-[#fffdf8]'
                      : 'border-[#d3ccbf] bg-[#f3eee6] hover:border-[#a99c8a]'
                  }`}
                >
                  <span className="block truncate text-sm font-semibold">
                    {source.fileName}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold ${statusToneClasses[status.tone]}`}
                    >
                      {status.label}
                    </span>
                    <span className="font-mono text-[0.66rem] text-[#6d7773]">
                      {formatFileSize(source.sizeBytes)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function SourcePreview({
  propertyId,
  source,
}: {
  propertyId: string
  source: PropertySourceWire | null
}) {
  const [preview, setPreview] = useState<{
    sourceId: string
    url: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{
    sourceId: string
    message: string
  } | null>(null)

  if (!source) {
    return (
      <section className="flex min-h-72 items-center justify-center border-b border-[#d8d1c4] bg-[#fffdf8] p-6 text-center xl:border-b-0 xl:border-r">
        <div className="max-w-sm">
          <p className="font-display text-2xl">Podgląd źródła</p>
          <p className="mt-2 text-sm leading-6 text-[#69736f]">
            Wybierz źródło z listy. Podgląd będzie dostępny dopiero po
            bezpiecznym wyniku kontroli pliku.
          </p>
        </div>
      </section>
    )
  }

  const status = formatSourceStatus(source.status)
  const ready = ['review_ready', 'completed'].includes(source.status)
  const embeddable =
    source.mediaType === 'application/pdf' ||
    source.mediaType.startsWith('image/')

  async function openPreview() {
    setLoading(true)
    setError(null)
    try {
      const result = await getPropertySourceDownload({
        propertyId,
        sourceId: source!.id,
        mode: embeddable ? 'preview' : 'download',
      })
      setPreview({ sourceId: source!.id, url: result.url })
    } catch {
      setError({
        sourceId: source!.id,
        message:
          'Podgląd nie jest jeszcze dostępny. Odśwież status i spróbuj ponownie.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-b border-[#d8d1c4] bg-[#fffdf8] p-4 sm:p-6 xl:border-b-0 xl:border-r">
      <div className="flex flex-col gap-3 border-b border-[#ded8cc] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#8b693e]">
            Bezpieczny podgląd
          </p>
          <h3 className="mt-1 truncate font-display text-2xl">
            {source.fileName}
          </h3>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${statusToneClasses[status.tone]}`}
        >
          {status.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metadata label="Format" value={formatMediaType(source.mediaType)} />
        <Metadata label="Rozmiar" value={formatFileSize(source.sizeBytes)} />
      </dl>

      <div className="mt-5 flex min-h-[22rem] items-center justify-center overflow-hidden rounded-2xl border border-[#ded8cc] bg-[#ebe7df]">
        {preview?.sourceId === source.id && embeddable ? (
          <iframe
            src={preview.url}
            title={`Podgląd pliku ${source.fileName}`}
            sandbox="allow-same-origin"
            className="h-[32rem] w-full bg-white"
          />
        ) : preview?.sourceId === source.id ? (
          <div className="max-w-sm p-6 text-center">
            <p className="font-display text-2xl">Plik gotowy</p>
            <p className="mt-2 text-sm leading-6 text-[#69736f]">
              Ten format otwieramy jako chronione pobranie, bez zamiany na
              aktywny HTML.
            </p>
            <a
              href={preview.url}
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#2d6b68] px-5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#2d6b68] focus-visible:ring-offset-2"
            >
              Pobierz oryginał
            </a>
          </div>
        ) : (
          <div className="max-w-sm p-6 text-center">
            <p className="font-display text-2xl">
              {ready ? 'Źródło jest bezpieczne' : status.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#69736f]">
              {ready
                ? 'Otwórz krótko ważny podgląd. Plik nigdy nie ma publicznego adresu.'
                : 'Podgląd odblokuje się po zakończeniu kontroli i analizy.'}
            </p>
            {ready ? (
              <button
                type="button"
                onClick={() => void openPreview()}
                disabled={loading}
                className="mt-5 min-h-11 rounded-full bg-[#2d6b68] px-5 text-sm font-semibold text-white outline-none disabled:cursor-wait disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2d6b68] focus-visible:ring-offset-2"
              >
                {loading ? 'Otwieram…' : 'Otwórz bezpieczny podgląd'}
              </button>
            ) : null}
            {error?.sourceId === source.id ? (
              <p role="alert" className="mt-3 text-sm text-[#873f39]">
                {error.message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}

function ProposalPanel({
  propertyId,
  proposals,
  onProposalUpdated,
}: {
  propertyId: string
  proposals: PropertyFactProposalWire[]
  onProposalUpdated: (proposal: PropertyFactProposalWire) => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [correctedValue, setCorrectedValue] = useState('')
  const [decisionNote, setDecisionNote] = useState('')
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  async function submitDecision(
    proposal: PropertyFactProposalWire,
    decision: ProposalDecision,
  ) {
    setPendingId(proposal.id)
    setErrorById((current) => ({ ...current, [proposal.id]: '' }))
    try {
      const result = await decidePropertyProposal({
        propertyId,
        proposalId: proposal.id,
        decision,
      })
      onProposalUpdated(result.proposal)
      setEditingId(null)
      setCorrectedValue('')
      setDecisionNote('')
    } catch {
      setErrorById((current) => ({
        ...current,
        [proposal.id]:
          'Nie zapisaliśmy decyzji. Dane pozostały bez zmian. Spróbuj ponownie.',
      }))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="bg-[#f2ede3] p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 border-b border-[#d8d1c4] pb-4">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#8b693e]">
            Decyzja człowieka
          </p>
          <h3 className="mt-1 font-display text-2xl">Propozycje faktów</h3>
        </div>
        <span className="font-mono text-xs text-[#6f7975]">
          {String(proposals.length).padStart(2, '0')}
        </span>
      </div>

      {proposals.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#bbb2a5] bg-[#f8f4ec] p-5 text-sm leading-6 text-[#66716d]">
          Gdy analiza znajdzie informacje poparte dowodem, pojawią się tutaj.
          Brak propozycji nigdy nie zostanie uzupełniony domysłem.
        </div>
      ) : (
        <ol className="mt-4 space-y-4">
          {proposals.map((proposal) => {
            const isConflict = ['conflict', 'needs_review'].includes(
              proposal.status,
            )
            const isFinal = ['accepted', 'corrected', 'rejected'].includes(
              proposal.status,
            )
            const isPending = pendingId === proposal.id
            const isEditing = editingId === proposal.id

            return (
              <li
                key={proposal.id}
                className="rounded-2xl border border-[#d6cec1] bg-[#fffdf8] p-4 shadow-[0_16px_40px_-35px_rgba(22,32,38,0.75)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#8b693e]">
                      {proposal.category}
                    </p>
                    <h4 className="mt-1 font-semibold">{proposal.label}</h4>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold ${
                      isConflict
                        ? statusToneClasses.danger
                        : isFinal
                          ? statusToneClasses.success
                          : statusToneClasses.warning
                    }`}
                  >
                    {formatProposalStatus(proposal.status)}
                  </span>
                </div>

                <p className="mt-4 font-display text-2xl">
                  {formatProposalValue(proposal.value)}
                  {proposal.unit ? (
                    <span className="ml-1 text-base text-[#65706c]">
                      {proposal.unit}
                    </span>
                  ) : null}
                </p>

                <blockquote className="mt-4 border-l-2 border-[#bd9360] pl-3 text-sm leading-6 text-[#596661]">
                  {proposal.evidenceText}
                </blockquote>
                <p className="mt-2 font-mono text-[0.66rem] text-[#6f7975]">
                  {formatEvidenceLocator(proposal.evidenceLocator)} · pewność{' '}
                  {Math.round(proposal.confidence * 100)}%
                </p>

                {isEditing ? (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-[#d7c6ae] bg-[#f8efe1] p-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      try {
                        const value = parseCorrectedProposalValue(
                          proposal.valueType,
                          correctedValue,
                        )
                        void submitDecision(proposal, {
                          action: 'correct_and_accept',
                          value,
                          ...(decisionNote.trim()
                            ? { note: decisionNote.trim() }
                            : {}),
                        })
                      } catch {
                        setErrorById((current) => ({
                          ...current,
                          [proposal.id]:
                            'Wpisz poprawną wartość w formacie zgodnym z polem.',
                        }))
                      }
                    }}
                  >
                    <label className="block text-sm font-semibold">
                      Poprawna wartość
                      <input
                        value={correctedValue}
                        onChange={(event) =>
                          setCorrectedValue(event.target.value)
                        }
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-[#bbae9d] bg-white px-3 font-normal outline-none focus:border-[#2d6b68] focus:ring-2 focus:ring-[#2d6b68]/20"
                        autoFocus
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Notatka do decyzji
                      <textarea
                        value={decisionNote}
                        onChange={(event) =>
                          setDecisionNote(event.target.value)
                        }
                        maxLength={1000}
                        rows={2}
                        className="mt-1.5 w-full rounded-xl border border-[#bbae9d] bg-white px-3 py-2 font-normal outline-none focus:border-[#2d6b68] focus:ring-2 focus:ring-[#2d6b68]/20"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <DecisionButton
                        type="submit"
                        primary
                        disabled={isPending}
                      >
                        Zapisz korektę
                      </DecisionButton>
                      <DecisionButton
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                      >
                        Anuluj
                      </DecisionButton>
                    </div>
                  </form>
                ) : null}

                {!isFinal && !isEditing ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e2dcd1] pt-4">
                    {isConflict ? (
                      <>
                        <DecisionButton
                          primary
                          disabled={isPending}
                          onClick={() =>
                            void submitDecision(proposal, {
                              action: 'keep_existing',
                            })
                          }
                        >
                          Zachowaj obecną
                        </DecisionButton>
                        <DecisionButton
                          disabled={isPending}
                          onClick={() =>
                            void submitDecision(proposal, {
                              action: 'accept_new',
                            })
                          }
                        >
                          Przyjmij nową
                        </DecisionButton>
                        <DecisionButton
                          disabled={isPending}
                          onClick={() =>
                            void submitDecision(proposal, {
                              action: 'keep_open',
                            })
                          }
                        >
                          Zostaw konflikt
                        </DecisionButton>
                      </>
                    ) : (
                      <>
                        <DecisionButton
                          primary
                          disabled={isPending}
                          onClick={() =>
                            void submitDecision(proposal, {
                              action: 'accept',
                            })
                          }
                        >
                          Zatwierdź
                        </DecisionButton>
                        <DecisionButton
                          disabled={isPending}
                          onClick={() => {
                            setEditingId(proposal.id)
                            setCorrectedValue(
                              proposal.value === null ||
                                proposal.value === undefined
                                ? ''
                                : typeof proposal.value === 'string'
                                  ? proposal.value
                                  : JSON.stringify(proposal.value),
                            )
                          }}
                        >
                          Popraw
                        </DecisionButton>
                        <DecisionButton
                          danger
                          disabled={isPending}
                          onClick={() =>
                            void submitDecision(proposal, {
                              action: 'reject',
                            })
                          }
                        >
                          Odrzuć
                        </DecisionButton>
                      </>
                    )}
                  </div>
                ) : null}

                {isPending ? (
                  <p aria-live="polite" className="mt-3 text-sm text-[#52615c]">
                    Zapisuję decyzję…
                  </p>
                ) : null}
                {errorById[proposal.id] ? (
                  <p role="alert" className="mt-3 text-sm text-[#873f39]">
                    {errorById[proposal.id]}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function DecisionButton({
  children,
  primary = false,
  danger = false,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-full border px-4 text-xs font-semibold outline-none transition-colors disabled:cursor-wait disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2d6b68] focus-visible:ring-offset-2 ${
        primary
          ? 'border-[#2d6b68] bg-[#2d6b68] text-white hover:bg-[#235956]'
          : danger
            ? 'border-[#c98e87] bg-[#f8e8e6] text-[#873f39] hover:bg-[#f1d9d6]'
            : 'border-[#bcb2a4] bg-[#fffdf8] text-[#33423d] hover:bg-[#eee9df]'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e0d9cd] bg-[#f7f3eb] p-3">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#7f8884]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}

function formatProposalStatus(
  status: PropertyFactProposalWire['status'],
): string {
  switch (status) {
    case 'pending':
      return 'Czeka na decyzję'
    case 'conflict':
      return 'Konflikt'
    case 'accepted':
      return 'Zatwierdzono'
    case 'corrected':
      return 'Poprawiono i zatwierdzono'
    case 'rejected':
      return 'Odrzucono'
    case 'needs_review':
      return 'Wymaga wyjaśnienia'
  }
}

function formatProposalValue(value: unknown): string {
  if (value === null || value === undefined) return 'Brak wartości'
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatMediaType(mediaType: string): string {
  const labels: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      'XLSX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'audio/mpeg': 'MP3',
    'audio/mp4': 'MP4 audio',
    'audio/wav': 'WAV',
    'audio/webm': 'WebM audio',
  }
  return labels[mediaType] ?? mediaType
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pl-PL', {
    maximumFractionDigits: 1,
  })} MB`
}

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Nie udało się wysłać pliku. Spróbuj ponownie.'
  }
  switch (error.message) {
    case 'UNSUPPORTED_SOURCE_FORMAT':
      return 'Ten format nie jest obsługiwany. Wybierz PDF, zdjęcie, DOCX, XLSX, CSV, TXT albo krótkie nagranie.'
    case 'SOURCE_FILE_TOO_LARGE':
      return 'Plik jest większy niż 25 MB. Zmniejsz go i spróbuj ponownie.'
    case 'SOURCE_REGISTER_FAILED':
      return 'Nie udało się przygotować bezpiecznej wysyłki. Spróbuj ponownie.'
    case 'SOURCE_UPLOAD_FAILED':
      return 'Wysyłka do prywatnego magazynu nie powiodła się. Spróbuj ponownie.'
    default:
      return 'Nie udało się wysłać pliku. Dane nieruchomości nie zostały zmienione.'
  }
}
