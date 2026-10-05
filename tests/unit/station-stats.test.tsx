// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { logListening, radioDb } from "@/lib/radio/store";
import { StationStats } from "@/components/radio/StationStats";

afterEach(async () => {
  await radioDb.listening.clear();
});

function renderStats(stationuuid: string): void {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <StationStats stationuuid={stationuuid} />
    </QueryClientProvider>,
  );
}

describe("StationStats", () => {
  it("shows the empty state with no banked sessions", async () => {
    renderStats("ghost");
    expect(await screen.findByText(/no listening time banked/i)).toBeInTheDocument();
  });

  it("renders the station total plus daily and trend charts", async () => {
    await logListening(
      { stationuuid: "a", name: "Alpha", started_at: new Date().toISOString(), seconds: 150 },
      radioDb,
    );
    await logListening({ stationuuid: "b", name: "Beta", started_at: new Date().toISOString(), seconds: 600 }, radioDb);
    renderStats("a");
    // Station-scoped: Alpha's 150s renders (Beta's 600s stays out).
    expect(await screen.findAllByText("2m")).not.toHaveLength(0);
    expect(screen.queryByText("10m")).not.toBeInTheDocument();
    // Daily rhythm + trend sections render in forced-compact layout.
    expect(screen.getByLabelText("Daily rhythm")).toBeInTheDocument();
    expect(screen.getByLabelText("Trends")).toBeInTheDocument();
  });
});
