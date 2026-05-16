import { useState, useEffect } from "react";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  return (localStorage.getItem("pp_theme") as Theme) || "dark";
}

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === "light") {
    el.classList.add("light");
    el.classList.remove("dark");
  } else {
    el.classList.remove("light");
    el.classList.add("dark");
  }
}

// Apply theme immediately on module load (before React renders)
applyTheme(getInitialTheme());

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("pp_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggleTheme };
}
