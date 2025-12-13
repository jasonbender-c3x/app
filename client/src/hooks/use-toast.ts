/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      USE-TOAST.TS - TOAST NOTIFICATION HOOK                   ║
 * ║                                                                               ║
 * ║  A complete toast notification system implementing a pub-sub pattern for     ║
 * ║  displaying temporary messages to users. This is the logic layer that        ║
 * ║  works with the Toaster component from shadcn/ui.                            ║
 * ║                                                                               ║
 * ║  Architecture:                                                                ║
 * ║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
 * ║  │                                                                         │ ║
 * ║  │   toast({ title: "Success!" })                                          │ ║
 * ║  │              ↓                                                          │ ║
 * ║  │   dispatch(ADD_TOAST) → reducer → memoryState                          │ ║
 * ║  │              ↓                                                          │ ║
 * ║  │   listeners.forEach(notify) → useToast subscribers                      │ ║
 * ║  │              ↓                                                          │ ║
 * ║  │   Toaster component re-renders with new toast                           │ ║
 * ║  │                                                                         │ ║
 * ║  └─────────────────────────────────────────────────────────────────────────┘ ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import * as React from "react"

/**
 * Import toast component types from shadcn/ui
 */
import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of toasts to display simultaneously
 * Older toasts are automatically removed when limit is reached
 */
const TOAST_LIMIT = 1

/**
 * Delay in milliseconds before removing a dismissed toast
 * Set high (1M ms) to prevent premature removal during animations
 */
const TOAST_REMOVE_DELAY = 1000000

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Extended toast type with additional properties
 * Combines base ToastProps with id and content fields
 */
type ToasterToast = ToastProps & {
  /** Unique identifier for the toast */
  id: string
  /** Toast title (primary message) */
  title?: React.ReactNode
  /** Toast description (secondary message) */
  description?: React.ReactNode
  /** Optional action button element */
  action?: ToastActionElement
}

/**
 * Available action types for the toast reducer
 * Using const assertion for type safety
 */
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",       // Add a new toast
  UPDATE_TOAST: "UPDATE_TOAST", // Update existing toast
  DISMISS_TOAST: "DISMISS_TOAST", // Start dismiss animation
  REMOVE_TOAST: "REMOVE_TOAST", // Remove from state
} as const

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Counter for generating unique toast IDs
 * Wraps around at MAX_SAFE_INTEGER to prevent overflow
 */
let count = 0

/**
 * Generate a unique toast ID
 * Uses incrementing counter converted to string
 * 
 * @returns {string} Unique toast identifier
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

// ============================================================================
// ACTION TYPES
// ============================================================================

type ActionType = typeof actionTypes

/**
 * Union type for all possible toast actions
 * Each action type has specific payload requirements
 */
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

/**
 * State shape for the toast system
 */
interface State {
  /** Array of currently active toasts */
  toasts: ToasterToast[]
}

// ============================================================================
// REMOVAL QUEUE
// ============================================================================

/**
 * Map of toast IDs to their removal timeouts
 * Prevents duplicate removals and allows cancellation
 */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Schedule a toast for removal after delay
 * 
 * This function:
 * 1. Checks if already scheduled (prevents duplicates)
 * 2. Sets timeout for delayed removal
 * 3. Dispatches REMOVE_TOAST action when timer fires
 * 
 * @param {string} toastId - ID of toast to remove
 */
const addToRemoveQueue = (toastId: string) => {
  // Skip if already scheduled for removal
  if (toastTimeouts.has(toastId)) {
    return
  }

  // Schedule removal after delay
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  // Store timeout for potential cancellation
  toastTimeouts.set(toastId, timeout)
}

// ============================================================================
// REDUCER
// ============================================================================

/**
 * Toast state reducer
 * 
 * Handles all toast state transitions:
 * - ADD_TOAST: Add new toast, enforce limit
 * - UPDATE_TOAST: Merge updates into existing toast
 * - DISMISS_TOAST: Set open=false, schedule removal
 * - REMOVE_TOAST: Actually remove from array
 * 
 * @param {State} state - Current state
 * @param {Action} action - Action to process
 * @returns {State} New state
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        // Add new toast at beginning, enforce limit
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        // Merge update into matching toast
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Side effect: Schedule removal for dismissed toasts
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        // Dismiss all toasts
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        // Set open=false to trigger dismiss animation
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    
    case "REMOVE_TOAST":
      // Remove specific toast or all toasts
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// ============================================================================
// PUB-SUB SYSTEM
// ============================================================================

/**
 * Array of listener functions subscribed to state changes
 * Each listener is called with new state when dispatch occurs
 */
const listeners: Array<(state: State) => void> = []

/**
 * In-memory state storage
 * Allows toast() to work without a React context
 */
let memoryState: State = { toasts: [] }

/**
 * Dispatch an action and notify all subscribers
 * 
 * This is the central dispatch function that:
 * 1. Updates the in-memory state via reducer
 * 2. Notifies all subscribed listeners (useToast hooks)
 * 
 * @param {Action} action - Action to dispatch
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

// ============================================================================
// TOAST FUNCTION
// ============================================================================

/**
 * Toast type without ID (ID is auto-generated)
 */
type Toast = Omit<ToasterToast, "id">

/**
 * Create and display a toast notification
 * 
 * This is the main function for creating toasts. It:
 * 1. Generates a unique ID
 * 2. Dispatches ADD_TOAST action
 * 3. Returns controls for updating/dismissing
 * 
 * @param {Toast} props - Toast configuration
 * @returns {Object} Toast controls { id, dismiss, update }
 * 
 * @example
 * // Simple toast
 * toast({ title: "Saved!" })
 * 
 * // Toast with description
 * toast({
 *   title: "Success",
 *   description: "Your changes have been saved.",
 * })
 * 
 * // Toast with action button
 * toast({
 *   title: "Undo",
 *   action: <ToastAction onClick={undo}>Undo</ToastAction>,
 * })
 * 
 * // Destructive toast
 * toast({
 *   title: "Error",
 *   variant: "destructive",
 * })
 */
function toast({ ...props }: Toast) {
  // Generate unique ID
  const id = genId()

  /**
   * Update this toast with new props
   * @param {ToasterToast} props - Properties to update
   */
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
    
  /**
   * Dismiss this toast
   */
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // Add toast to state
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      // Auto-dismiss when closed via UI
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // Return controls for this toast
  return {
    id: id,
    dismiss,
    update,
  }
}

// ============================================================================
// USE TOAST HOOK
// ============================================================================

/**
 * useToast - Toast Notification Hook
 * 
 * React hook that subscribes to toast state and provides
 * functions for creating and dismissing toasts.
 * 
 * This hook:
 * 1. Subscribes to the global toast state on mount
 * 2. Re-renders when toasts are added/removed/updated
 * 3. Cleans up subscription on unmount
 * 
 * @returns {Object} Toast state and functions
 * @returns {ToasterToast[]} .toasts - Current array of toasts
 * @returns {Function} .toast - Create a new toast
 * @returns {Function} .dismiss - Dismiss a toast by ID
 * 
 * @example
 * function MyComponent() {
 *   const { toast, dismiss, toasts } = useToast();
 *   
 *   const handleClick = () => {
 *     const { id } = toast({ title: "Hello!" });
 *     // Can dismiss later: dismiss(id)
 *   };
 *   
 *   return <button onClick={handleClick}>Show Toast</button>;
 * }
 */
function useToast() {
  // Local state synced with global memoryState
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    // Subscribe to state changes
    listeners.push(setState)
    
    // Cleanup: Unsubscribe on unmount
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,                 // { toasts: ToasterToast[] }
    toast,                    // Create new toast
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { useToast, toast }
