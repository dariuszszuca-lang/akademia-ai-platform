type WizardSelectionHandlers = {
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}

const SELECTION_FEEDBACK_DELAY_MS = 220

export type WizardSelectionScheduler = {
  schedule: (value: string) => void
  cancel: () => void
}

export function createWizardSelectionScheduler(
  handlers: WizardSelectionHandlers,
): WizardSelectionScheduler {
  let locked = false
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    schedule(value) {
      if (locked) return
      locked = true
      handlers.onChange(value)
      timer = setTimeout(() => {
        timer = null
        handlers.onSubmit(value)
      }, SELECTION_FEEDBACK_DELAY_MS)
    },
    cancel() {
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}
