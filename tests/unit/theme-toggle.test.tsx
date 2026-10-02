// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme";
import { flippedTheme, useTheme } from "@/lib/theme";

function Toggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <span data-testid='resolved'>{resolvedTheme}</span>
      <button
        type='button'
        onClick={() => {
          setTheme(flippedTheme());
        }}>
        toggle
      </button>
    </>
  );
}

describe("theme toggle", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    Object.defineProperty(globalThis, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("light", "dark");
  });

  it("first press switches the theme (system dark)", () => {
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    act(() => {
      screen.getByRole("button").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("toggle follows the applied DOM theme when something else rewrites classes", () => {
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    // A foreign writer (extension, stale script) flips the class outside state.
    act(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    act(() => {
      screen.getByRole("button").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("flippedTheme reads the applied class", () => {
    document.documentElement.classList.add("dark");
    expect(flippedTheme()).toBe("light");
    document.documentElement.classList.remove("dark");
    expect(flippedTheme()).toBe("dark");
  });
});
