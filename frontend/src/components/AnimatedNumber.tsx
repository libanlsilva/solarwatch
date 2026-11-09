import { useEffect, useRef, useState } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

// Eases the displayed value toward the target. Reduced motion (or no target) shows it immediately.
export function useAnimatedNumber(target: number | undefined, duration = 650): number | undefined {
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    if (target === undefined || current.current === undefined || prefersReducedMotion() || current.current === target) {
      current.current = target
      setShown(target)
      return
    }
    const from = current.current
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      current.current = from + (target - from) * eased
      setShown(current.current)
      if (progress < 1) frame = requestAnimationFrame(step)
      else current.current = target
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return shown
}

// Briefly true after the value changes (not on first render), to flash a card.
export function usePulse(value: unknown, duration = 700): boolean {
  const [pulse, setPulse] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (prefersReducedMotion()) return
    setPulse(true)
    const timer = setTimeout(() => setPulse(false), duration)
    return () => clearTimeout(timer)
  }, [value, duration])
  return pulse
}

export function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const shown = useAnimatedNumber(value)
  return <>{format(shown ?? value)}</>
}
