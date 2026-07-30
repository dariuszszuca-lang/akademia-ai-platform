import { describe, expect, it, vi } from 'vitest'
import { createWizardSelectionScheduler } from './wizard-selection'

describe('createWizardSelectionScheduler', () => {
  it('submits the freshly selected value after the visual delay', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const scheduler = createWizardSelectionScheduler({
      onChange,
      onSubmit,
    })

    scheduler.schedule('beginner')

    expect(onChange).toHaveBeenCalledWith('beginner')
    expect(onSubmit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(220)

    expect(onSubmit).toHaveBeenCalledWith('beginner')
    vi.useRealTimers()
  })

  it('keeps one submission in flight after rapid repeated choices', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const scheduler = createWizardSelectionScheduler({
      onChange,
      onSubmit,
    })

    scheduler.schedule('beginner')
    scheduler.schedule('advanced')
    vi.advanceTimersByTime(440)
    scheduler.schedule('advanced')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('beginner')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('beginner')
    vi.useRealTimers()
  })
})
