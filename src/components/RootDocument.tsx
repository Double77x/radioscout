import type { ReactNode } from "react";
import { Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { CommandPalette } from "@/components/CommandPalette";
import { AppUpdateDialog } from "@/components/AppUpdateDialog";
import { NativeShell } from "@/components/NativeShell";
import { queryClient } from "@/lib/query-client";

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className='min-h-screen bg-background font-sans text-foreground antialiased'>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
        <TooltipProvider>
          <HotkeysProvider>
            <Outlet />
            <CommandPalette />
            <NativeShell />
            <AppUpdateDialog />
            <Sonner />
          </HotkeysProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
