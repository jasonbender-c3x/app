/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    USE-MOBILE.TSX - MOBILE DETECTION HOOK                     ║
 * ║                                                                               ║
 * ║  A custom React hook that detects whether the current viewport is mobile     ║
 * ║  (width < 768px). Uses the CSS Media Query API for efficient detection        ║
 * ║  with automatic updates when the viewport size changes.                       ║
 * ║                                                                               ║
 * ║  Usage:                                                                       ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │  const isMobile = useIsMobile();                                       │  ║
 * ║  │                                                                        │  ║
 * ║  │  if (isMobile) {                                                       │  ║
 * ║  │    return <MobileLayout />;                                            │  ║
 * ║  │  }                                                                     │  ║
 * ║  │  return <DesktopLayout />;                                             │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import * as React from "react"

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Mobile breakpoint in pixels
 * 
 * This matches the common "md" breakpoint in Tailwind CSS (768px).
 * Viewports with width < 768px are considered "mobile".
 * 
 * Standard Tailwind breakpoints:
 * - sm: 640px
 * - md: 768px  ← Our mobile threshold
 * - lg: 1024px
 * - xl: 1280px
 * - 2xl: 1536px
 */
const MOBILE_BREAKPOINT = 768

// ============================================================================
// USE IS MOBILE HOOK
// ============================================================================

/**
 * useIsMobile - Mobile Viewport Detection Hook
 * 
 * Detects whether the current viewport width is below the mobile breakpoint.
 * Uses the CSS Media Query API (matchMedia) for efficient, browser-native
 * detection that automatically responds to viewport changes.
 * 
 * How it works:
 * 1. Creates a MediaQueryList for "(max-width: 767px)"
 * 2. Sets initial state based on current viewport
 * 3. Listens for media query changes (resize, orientation change)
 * 4. Updates state when viewport crosses the breakpoint
 * 5. Cleans up listener on unmount
 * 
 * Why matchMedia instead of resize event:
 * - More performant (browser-optimized)
 * - Fires only when crossing breakpoint, not every pixel
 * - Handles orientation changes automatically
 * 
 * Initial State:
 * - undefined during SSR (no window object)
 * - Immediately set after mount
 * 
 * @returns {boolean} true if viewport is mobile (<768px), false otherwise
 * 
 * @example
 * function ResponsiveComponent() {
 *   const isMobile = useIsMobile();
 *   
 *   return (
 *     <div className={isMobile ? "flex-col" : "flex-row"}>
 *       {isMobile ? <MobileMenu /> : <DesktopMenu />}
 *     </div>
 *   );
 * }
 */
export function useIsMobile() {
  /**
   * Mobile state
   * - undefined: Initial state during SSR or before first check
   * - true: Viewport is mobile (<768px)
   * - false: Viewport is desktop (>=768px)
   */
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    /**
     * Create a MediaQueryList for the mobile breakpoint
     * The query "(max-width: 767px)" matches when viewport is < 768px
     * (using 767px because max-width is inclusive)
     */
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    /**
     * Handler for media query changes
     * Called when viewport crosses the 768px threshold
     */
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Listen for viewport changes that cross the breakpoint
    mql.addEventListener("change", onChange)
    
    // Set initial value based on current viewport
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    // Cleanup: Remove listener on unmount
    return () => mql.removeEventListener("change", onChange)
  }, [])

  /**
   * Convert to boolean (handles undefined initial state)
   * - undefined becomes false (assumes desktop for SSR)
   * - true/false passes through
   */
  return !!isMobile
}
