import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type Theme = "dark" | "light";
type BrandTheme = "classic" | "business" | "creative";

interface ThemeContextType {
  theme: Theme;
  brandTheme: BrandTheme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setBrandTheme: (theme: BrandTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
