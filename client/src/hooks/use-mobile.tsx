/**
 * @module use-mobile
 * React hook for detecting whether the viewport is at mobile breakpoint width.
 */
import * as React from "react"

/** Pixel width threshold below which the viewport is considered mobile. */
const MOBILE_BREAKPOINT = 768

/**
 * Detects whether the current viewport width is below the mobile breakpoint (768px).
 * Uses `window.matchMedia` to listen for viewport resize changes and updates reactively.
 *
 * @returns `true` if the viewport width is less than {@link MOBILE_BREAKPOINT}, `false` otherwise.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
