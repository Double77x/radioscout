import type { ReactNode } from "react";
import { PlayerDock } from "../radio/PlayerDock";
import { StationDetailSheet } from "../radio/StationDetailSheet";
import { SwipeBack } from "./SwipeBack";
import Footer from "@/components/Footer";
import { closeStationDetail, useStationDetail } from "@/hooks/use-station-detail";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Mobile-first app frame. On phones the column fills the viewport; on larger
 * screens it sits as a centred 430px column over a fog backdrop.
 *
 * The top padding is the system status-bar inset (Android 15+ edge-to-edge,
 * iOS notch). It self-corrects: 0 on desktop browsers and pre-inset WebViews,
 * status-bar height where the WebView draws under the system bars.
 */
export function AppShell({ children }: AppShellProps) {
  const { station } = useStationDetail();
  return (
    <div className='min-h-dvh bg-scout-fog'>
      <div className='mx-auto flex min-h-dvh w-full max-w-107.5 flex-col bg-background pt-[env(safe-area-inset-top)] sm:border-x sm:border-border lg:max-w-2xl xl:max-w-4xl'>
        <SwipeBack>
          {children}
          <Footer />
          <PlayerDock />
        </SwipeBack>
        <StationDetailSheet station={station} onClose={closeStationDetail} />
      </div>
    </div>
  );
}
