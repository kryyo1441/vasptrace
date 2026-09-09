"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin passthrough — next-themes toggles the .dark class app/globals.css's
// tokens already key off (attribute="class"), and its own script avoids the
// flash-of-wrong-theme on first paint. See app/layout.tsx for the
// suppressHydrationWarning this requires on <html>.
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
