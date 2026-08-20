import { useEffect, useRef, useState } from 'react'

/**
 * Motion, shared by the marketing site and the app.
 *
 * The two want different things, and treating them the same is the usual
 * mistake. A marketing page is read once, top to bottom, so revealing sections
 * as they arrive rewards scrolling. An app screen is opened forty times a day —
 * the same reveal there means waiting for your own data to fade in, every time,
 * forever. So: scroll reveals on marketing, a single fast enter plus responsive
 * micro-interactions in the app.
 *
 * Everything here degrades to nothing under prefers-reduced-motion, and no
 * content is ever hidden behind a callback that might not fire.
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * Reveals `[data-reveal]` elements as they scroll into view. Marketing only.
 *
 * Three safeguards, in order of importance: reduced motion shows everything
 * immediately; anything already on screen reveals on the next frame rather than
 * waiting for the observer; and a timeout reveals everything regardless. Hiding
 * content until a callback fires means any failure of that callback leaves the
 * page blank, which no animation is worth.
 */
export function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!nodes.length) return

    const reveal = (el: Element) => el.setAttribute('data-revealed', 'true')

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      nodes.forEach(reveal)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          reveal(entry.target)
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )

    nodes.forEach((n) => observer.observe(n))

    const raf = requestAnimationFrame(() => {
      nodes.forEach((n) => {
        if (n.getBoundingClientRect().top < window.innerHeight) {
          reveal(n)
          observer.unobserve(n)
        }
      })
    })

    const failsafe = window.setTimeout(() => {
      nodes.forEach(reveal)
      observer.disconnect()
    }, 1600)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(failsafe)
      observer.disconnect()
    }
  }, [])
}

/**
 * Marks the page as entered one frame after mount, so the app's enter
 * transition runs on navigation.
 *
 * Returns a `data-entered` value rather than toggling a class, so the CSS lives
 * in the stylesheet with the rest of the motion rather than being scattered
 * through components.
 */
export function usePageEnter(key: string) {
  const [entered, setEntered] = useState(prefersReducedMotion())

  useEffect(() => {
    if (prefersReducedMotion()) {
      setEntered(true)
      return
    }
    setEntered(false)
    const raf = requestAnimationFrame(() => setEntered(true))
    // Same reasoning as the reveal failsafe: never leave content depending on a
    // frame callback that might not arrive.
    const failsafe = window.setTimeout(() => setEntered(true), 400)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(failsafe)
    }
  }, [key])

  return entered
}

/**
 * Adds a data attribute to an element once the window has scrolled, for headers
 * that should lift off the content rather than sit raised at rest.
 */
export function useScrolled<T extends HTMLElement>(threshold = 8) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const onScroll = () => ref.current?.toggleAttribute('data-scrolled', window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return ref
}
