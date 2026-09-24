import { afterEach, describe, expect, it, vi } from "vitest";

const { getInfo } = vi.hoisted(() => ({ getInfo: vi.fn() }));

vi.mock("@/lib/capacitor", () => ({ isNative: () => true }));
vi.mock("@capacitor/app", () => ({ App: { getInfo } }));

import { checkApkUpdate } from "@/lib/app-update";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("checkApkUpdate on F-Droid", () => {
  it("does not inspect the install or contact GitHub", async () => {
    vi.stubEnv("VITE_DISTRIBUTION", "fdroid");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(checkApkUpdate()).resolves.toBeNull();
    expect(getInfo).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
