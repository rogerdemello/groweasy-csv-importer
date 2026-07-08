"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/** App-wide client providers (theme with system + persisted preference). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
