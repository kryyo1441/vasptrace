"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

// Both icons always render; the `.dark` class (from next-themes' "class"
// attribute strategy) picks which one shows via CSS. That sidesteps the
// usual "theme is undefined until mount" hydration-mismatch dance — no
// client-only state needed just to pick an icon.
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Toggle theme"
      className="relative"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden="true" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden="true" />
    </Button>
  );
}
