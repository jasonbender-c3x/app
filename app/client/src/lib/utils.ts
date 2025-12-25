/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         UTILS.TS - UTILITY FUNCTIONS                          ║
 * ║                                                                               ║
 * ║  Collection of utility functions used throughout the application.            ║
 * ║  Currently contains the class name merging utility for Tailwind CSS.         ║
 * ║                                                                               ║
 * ║  The `cn` function is essential for:                                          ║
 * ║    - Conditional class application                                            ║
 * ║    - Merging component variants                                               ║
 * ║    - Overriding default styles                                                ║
 * ║    - Handling Tailwind class conflicts                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * clsx - A tiny utility for constructing className strings conditionally
 * 
 * Supports:
 * - Strings: "text-red-500"
 * - Objects: { "text-red-500": isError }
 * - Arrays: ["base-class", condition && "conditional-class"]
 * - Nested combinations of all the above
 * 
 * @see https://github.com/lukeed/clsx
 */
import { clsx, type ClassValue } from "clsx"

/**
 * tailwind-merge - Merge Tailwind CSS classes without style conflicts
 * 
 * Intelligently merges Tailwind classes, handling:
 * - Conflicting utilities: "px-2 px-4" → "px-4"
 * - Overrides: "text-red-500 text-blue-500" → "text-blue-500"
 * - Variants: "hover:bg-red-500 hover:bg-blue-500" → "hover:bg-blue-500"
 * 
 * @see https://github.com/dcastil/tailwind-merge
 */
import { twMerge } from "tailwind-merge"

// ============================================================================
// CLASS NAME UTILITY
// ============================================================================

/**
 * cn - Conditional Class Name Utility
 * 
 * Combines clsx and tailwind-merge to provide a robust class name
 * composition utility. This is the standard pattern used in shadcn/ui
 * components and throughout the application.
 * 
 * How it works:
 * 1. clsx processes the inputs (handles conditionals, arrays, objects)
 * 2. twMerge resolves Tailwind conflicts (last class wins)
 * 
 * Why both libraries?
 * - clsx alone: Would keep conflicting classes like "px-2 px-4"
 * - twMerge alone: Doesn't handle conditional objects well
 * - Combined: Best of both worlds
 * 
 * @param {...ClassValue} inputs - Any combination of class values
 * @returns {string} Merged, conflict-resolved class string
 * 
 * @example
 * // Basic usage
 * cn("text-red-500", "font-bold")
 * // → "text-red-500 font-bold"
 * 
 * @example
 * // Conditional classes
 * cn("base-class", isActive && "active-class")
 * // → "base-class active-class" or "base-class"
 * 
 * @example
 * // Object syntax
 * cn("base", { "text-red-500": hasError, "text-green-500": isSuccess })
 * // → "base text-red-500" or "base text-green-500" or "base"
 * 
 * @example
 * // Conflict resolution (Tailwind)
 * cn("px-2 py-1", "px-4")
 * // → "py-1 px-4" (px-4 wins over px-2)
 * 
 * @example
 * // Complex example (component variants)
 * cn(
 *   "rounded-md font-medium",                    // Base styles
 *   variant === "primary" && "bg-blue-500",      // Variant
 *   variant === "secondary" && "bg-gray-500",    // Variant
 *   isDisabled && "opacity-50 cursor-not-allowed", // State
 *   className                                      // User override
 * )
 * 
 * @example
 * // In a component
 * function Button({ className, variant, ...props }) {
 *   return (
 *     <button
 *       className={cn(
 *         "px-4 py-2 rounded",
 *         variant === "primary" ? "bg-blue-500" : "bg-gray-500",
 *         className  // Allows parent to override styles
 *       )}
 *       {...props}
 *     />
 *   );
 * }
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
