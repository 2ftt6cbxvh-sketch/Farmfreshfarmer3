import { Moon, Sun, Laptop } from "lucide-react";
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
          className="relative rounded-full w-9 h-9 border-emerald-500/30 bg-card/80 backdrop-blur hover:bg-accent/10 transition-all duration-300 shadow-sm"
          data-testid="button-theme-toggle"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-emerald-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl border border-emerald-500/30 bg-card/95 backdrop-blur-2xl p-1.5 shadow-xl z-50">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`gap-2.5 rounded-xl font-bold cursor-pointer text-xs ${theme === "light" ? "bg-emerald-500/15 text-primary" : ""}`}
        >
          <Sun className="h-4 w-4 text-amber-500" /> Light Mode
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`gap-2.5 rounded-xl font-bold cursor-pointer text-xs ${theme === "dark" ? "bg-emerald-500/15 text-primary" : ""}`}
        >
          <Moon className="h-4 w-4 text-emerald-400" /> Dark Mode (Pitch Black)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`gap-2.5 rounded-xl font-bold cursor-pointer text-xs ${theme === "system" ? "bg-emerald-500/15 text-primary" : ""}`}
        >
          <Laptop className="h-4 w-4 text-muted-foreground" /> System Default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
