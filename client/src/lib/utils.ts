/**
 * @module utils
 * Shared utility functions for the client application.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS class names using `clsx` and `tailwind-merge`.
 * Handles conditional classes, arrays, and deduplicates conflicting Tailwind utilities.
 *
 * @param inputs - Any number of class value arguments (strings, objects, arrays, etc.)
 * @returns The merged and deduplicated class name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
