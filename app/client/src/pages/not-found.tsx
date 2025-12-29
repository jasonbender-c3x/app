/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        NOT-FOUND.TSX - 404 ERROR PAGE                         ║
 * ║                                                                               ║
 * ║  A user-friendly 404 error page displayed when navigating to a route          ║
 * ║  that doesn't exist in the application. This serves as a fallback             ║
 * ║  route in the Wouter router configuration.                                    ║
 * ║                                                                               ║
 * ║  Design:                                                                      ║
 * ║  ┌──────────────────────────────────────────────────────────────────────┐    ║
 * ║  │                                                                      │    ║
 * ║  │     ┌────────────────────────────────────────────────────────┐       │    ║
 * ║  │     │  ⚠️ 404 Page Not Found                                 │       │    ║
 * ║  │     │                                                        │       │    ║
 * ║  │     │  Did you forget to add the page to the router?         │       │    ║
 * ║  │     └────────────────────────────────────────────────────────┘       │    ║
 * ║  │                                                                      │    ║
 * ║  └──────────────────────────────────────────────────────────────────────┘    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * shadcn/ui Card Components
 * - Card: Container component with consistent styling
 * - CardContent: Inner content wrapper with padding
 */
import { Card, CardContent } from "@/components/ui/card";

/**
 * AlertCircle Icon from Lucide
 * Red circle with exclamation mark, indicating an error/warning
 */
import { AlertCircle } from "lucide-react";

// ============================================================================
// NOT FOUND COMPONENT
// ============================================================================

/**
 * NotFound Component - 404 Error Page
 * 
 * Displays when users navigate to a URL that doesn't match any
 * defined routes in the application. This is set as the fallback
 * route (no path prop) in App.tsx's router configuration.
 * 
 * Features:
 * - Centered card layout with max-width constraint
 * - Error icon with clear "404" heading
 * - Developer hint about router configuration
 * - Responsive design (works on all screen sizes)
 * 
 * Router Integration:
 * In App.tsx, this component is used as the fallback:
 * ```tsx
 * <Switch>
 *   <Route path="/" component={Home} />
 *   <Route path="/editor" component={EditorPage} />
 *   <Route component={NotFound} /> // Matches all unmatched routes
 * </Switch>
 * ```
 * 
 * @returns {JSX.Element} The 404 error page
 * 
 * @example
 * // User navigates to /nonexistent-page
 * // Router renders NotFound component
 */
export default function NotFound() {
  return (
    // Full-screen container with centered content and light gray background
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      
      {/* 
       * Error Card
       * - max-w-md: Maximum width of 28rem (448px)
       * - mx-4: Horizontal margin for mobile screens
       */}
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          
          {/* Error Header: Icon + Title */}
          <div className="flex mb-4 gap-2">
            {/* Red alert icon indicating error */}
            <AlertCircle className="h-8 w-8 text-red-500" />
            
            {/* 404 Title */}
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          {/* 
           * Developer Hint
           * Helpful message for developers who may have forgotten
           * to register a new page in the router
           */}
          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
          
        </CardContent>
      </Card>
    </div>
  );
}
