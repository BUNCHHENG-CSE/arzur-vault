"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="relative border-border bg-background/80 text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground"
            aria-label="Toggle color theme"
            title="Switch color theme (Light / Dark / System)"
          />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 text-amber-500 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 text-emerald-400 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] tracking-wider uppercase">
            Appearance
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setTheme("light")}
            className="cursor-pointer justify-between text-xs"
          >
            <span className="flex items-center gap-2">
              <Sun className="size-3.5 text-amber-500" />
              Light
            </span>
            {theme === "light" && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setTheme("dark")}
            className="cursor-pointer justify-between text-xs"
          >
            <span className="flex items-center gap-2">
              <Moon className="size-3.5 text-emerald-500" />
              Dark
            </span>
            {theme === "dark" && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setTheme("system")}
            className="cursor-pointer justify-between text-xs"
          >
            <span className="flex items-center gap-2">
              <Monitor className="size-3.5 text-muted-foreground" />
              System
            </span>
            {theme === "system" && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
