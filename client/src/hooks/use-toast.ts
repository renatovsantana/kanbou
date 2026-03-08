/**
 * @module use-toast
 * Lightweight toast notification system with an external store pattern.
 * Provides the `toast` function and `useToast` hook for showing transient messages.
 */
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

/** Maximum number of toasts visible simultaneously. */
const TOAST_LIMIT = 1

/** Delay (ms) before a dismissed toast is removed from the DOM. */
const TOAST_REMOVE_DELAY = 1000000

/** Extended toast props with an auto-generated `id` and optional title/description/action. */
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

/** Discriminated action types for the toast reducer. */
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

/** Monotonically increasing counter for unique toast IDs. */
let count = 0

/**
 * Generates a unique string ID for a new toast notification.
 * Wraps around at `Number.MAX_SAFE_INTEGER`.
 *
 * @returns A unique numeric string identifier.
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

/** Mapping of action type string literals. */
type ActionType = typeof actionTypes

/** Union of all possible reducer actions for the toast store. */
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

/** Internal state shape for the toast store. */
interface State {
  toasts: ToasterToast[]
}

/** Tracks pending removal timeouts by toast ID. */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Schedules a toast for removal after {@link TOAST_REMOVE_DELAY} milliseconds.
 * No-ops if the toast is already queued for removal.
 *
 * @param toastId - The ID of the toast to queue for removal.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * Pure reducer function that handles toast state transitions.
 * Supports adding, updating, dismissing, and removing toasts.
 *
 * @param state - The current toast state.
 * @param action - The dispatched action.
 * @returns The next toast state.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
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

/** Registered listener callbacks that receive state updates. */
const listeners: Array<(state: State) => void> = []

/** In-memory singleton state for the toast store (external store pattern). */
let memoryState: State = { toasts: [] }

/**
 * Dispatches an action to the toast reducer and notifies all listeners.
 *
 * @param action - The action to dispatch.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

/** Input type for creating a toast (ID is auto-generated). */
type Toast = Omit<ToasterToast, "id">

/**
 * Imperatively creates and shows a new toast notification.
 *
 * @param props - Toast properties (title, description, variant, action, etc.).
 * @returns An object with `id`, `dismiss`, and `update` helpers for the created toast.
 */
function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * React hook that subscribes to the toast store and re-renders on state changes.
 *
 * @returns An object containing the current `toasts` array, the imperative `toast` creator,
 *          and a `dismiss` function to programmatically close toasts.
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
