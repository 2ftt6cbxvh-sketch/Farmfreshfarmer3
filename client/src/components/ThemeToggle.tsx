import { Moon, Sun, Zap } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full w-9 h-9 border-primary/20 bg-background/80 backdrop-blur hover:bg-accent/10 transition-all duration-300 shadow-sm"
          data-testid="button-theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === "oled" ? (
            <Zap className="h-4 w-4 text-yellow-400 transition-all duration-300" />
          ) : (
            <>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-emerald-400" />
            </>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-card-border">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`gap-2 cursor-pointer ${theme === "light" ? "bg-accent/10 font-semibold text-primary" : ""}`}
        >
          <Sun className="h-4 w-4 text-amber-500" /> Light Mode (Day)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`gap-2 cursor-pointer ${theme === "dark" ? "bg-accent/10 font-semibold text-primary" : ""}`}
        >
          <Moon className="h-4 w-4 text-emerald-400" /> Dark Mode (Night)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("oled")}
          className={`gap-2 cursor-pointer ${theme === "oled" ? "bg-accent/10 font-semibold text-primary" : ""}`}
        >
          <Zap className="h-4 w-4 text-yellow-400" /> OLED Super Dark (Pure Black)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`gap-2 cursor-pointer ${theme === "system" ? "bg-accent/10 font-semibold text-primary" : ""}`}
        >
          💻 System Auto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
