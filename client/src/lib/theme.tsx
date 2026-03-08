/**
 * @module theme
 * Theme context, provider, and hook for managing dark/light mode and brand themes.
 * Persists choices to localStorage and syncs with a server-side branding setting.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

/** Available colour-scheme modes. */
type Theme = "dark" | "light";

/** Available brand colour presets. */
type BrandTheme = "classic" | "business" | "creative";

/** Contract exposed by the theme context to consuming components. */
interface ThemeContextType {
  theme: Theme;
  brandTheme: BrandTheme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setBrandTheme: (theme: BrandTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provides dark/light and brand-theme state to the component tree.
 *
 * - Reads initial values from `localStorage` (keys `shift-theme`, `shift-brand-theme`).
 * - Fetches the server-side branding preference from `/api/settings/branding` and
 *   syncs the brand theme when the server value changes.
 * - Toggles the `dark` class on `document.documentElement` for Tailwind dark-mode.
 * - Sets a `data-theme` attribute on the root element for brand-theme CSS switching.
 *
 * @param children - React child nodes to render within the provider.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("shift-theme") as Theme;
      return stored || "dark";
    }
    return "dark";
  });

  const [brandTheme, setBrandThemeState] = useState<BrandTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("shift-brand-theme") as BrandTheme;
      return stored || "classic";
    }
    return "classic";
  });

  const { data: branding } = useQuery<{ systemTheme: string }>({
    queryKey: ["/api/settings/branding"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (branding?.systemTheme) {
      const serverTheme = branding.systemTheme as BrandTheme;
      if (["classic", "business", "creative"].includes(serverTheme)) {
        setBrandThemeState(serverTheme);
        localStorage.setItem("shift-brand-theme", serverTheme);
      }
    }
  }, [branding?.systemTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("shift-theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (brandTheme === "classic") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", brandTheme);
    }
  }, [brandTheme]);

  const toggleTheme = () => {
    setThemeState(prev => prev === "dark" ? "light" : "dark");
  };

  const setTheme = (t: Theme) => setThemeState(t);

  const setBrandTheme = (t: BrandTheme) => {
    setBrandThemeState(t);
    localStorage.setItem("shift-brand-theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, brandTheme, toggleTheme, setTheme, setBrandTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Convenience hook to access the current theme context.
 *
 * @returns The `ThemeContextType` containing the current theme, brand theme, and setter functions.
 * @throws {Error} If called outside of a `ThemeProvider`.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
