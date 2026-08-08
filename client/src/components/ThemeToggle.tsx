import { Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="relative rounded-full w-9 h-9 border-emerald-500/30 bg-card/80 backdrop-blur hover:bg-accent/10 transition-all duration-300 shadow-sm cursor-pointer active:scale-90"
      data-testid="button-theme-toggle"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <span className="text-base select-none animate-in fade-in zoom-in-75 duration-200">🌕</span>
      ) : (
        <Sun className="h-4 w-4 text-amber-500 animate-in fade-in zoom-in-75 duration-200" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
