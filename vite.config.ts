/// <reference types="vite-plus/test" />
import { defineConfig } from "vite-plus";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { bbcProbe, icyProbe } from "./scripts/icy-probe-plugin";
import toolchain from "./toolchain.config";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    // Lint/format live in toolchain.config.ts, which must keep a single
    // default export.
    lint: toolchain.lint,
    fmt: toolchain.fmt,
    // Tasks: a name may live here OR in package.json, never both.
    run: {
      // Cache everything; Vite+ auto-excludes tasks that read and write the same paths.
      cache: true,
      tasks: {
        build: {
          // `vp build` is the Vite build (incl. prerender) alone; tsc and the
          // postbuild scripts are separate cached stages in one chain.
          // `cap:android` consumes this task, so keep the full chain here.
          // The service worker is web-only: `generate-sw.mjs` honors
          // CAPACITOR_BUILD, but the `vp` task cache replays outputs without
          // re-running — so native pipelines strip unconditionally via
          // `strip-sw.mjs` right before consuming dist (see `cap:android`,
          // `release-apk.yml`, `publish-ota.mjs`). That step is the real
          // guarantee; the env flag just documents intent.
          command:
            "vp build && tsc -b && node scripts/generate-sitemap.js && node scripts/apply-header-policy.js && node scripts/generate-sw.mjs && node scripts/check-doc-pointers.js",
          cache: {
            output: ["dist/**"],
          },
        },
      },
    },
    test: {
      globals: true,
      // Most suites are pure logic / fake-indexeddb — node is enough and
      // avoids creating a jsdom per file. The 3 suites that need DOM globals
      // (use-object-url, dismissed-alerts, backup) opt back in with a
      // `// @vitest-environment jsdom` pragma.
      environment: "node",
      // Create the environment once per worker instead of once per file
      // (keeps per-file isolation, unlike isolate: false).
      pool: "vmThreads",
      setupFiles: "./src/test-setup.ts",
      css: true,
      include: ["tests/**/*.test.{ts,tsx}"],
    },
    server: {
      host: "::",
      port: 8080,
      open: true,
    },
    plugins: [
      // TanStack Start (bundles its own router + code-splitting plugins).
      // Do NOT also add TanStackRouterVite() here — the duplicate triggers
      // "TSRSplitComponent is not defined" during SSR dev.
      tanstackStart({
        srcDirectory: "src",
        prerender: {
          enabled: true,
          crawlLinks: true,
          failOnError: true,
          autoSubfolderIndex: false,
          filter: ({ path: routePath }) => !routePath.includes("#") && !routePath.includes("?"),
        },
        pages: [{ path: "/404" }],
        // Inline critical CSS to eliminate FOUC on hard refresh:
        // without this, the stylesheet is a separate blocking request and
        // TanStack's streaming can paint before it arrives.
        server: {
          build: {
            inlineCss: { enabled: true, transformAssets: true },
          },
        },
      }),
      // React Compiler via the plugin's Oxc transform. No options, see AGENTS.md.
      react({ compiler: true }),
      tailwindcss(),
      // Dev-only stream probes (apply serve inside), never shipped.
      icyProbe(),
      bbcProbe(),
      {
        ...visualizer({
          filename: "bundle-analysis-client.html",
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
        // Environments API: the legacy `apply` + `isSsrBuild` form does not
        // fire per-environment under TanStack Start, so the report used to
        // contain SSR data (server.js). Pin it to the client environment.
        applyToEnvironment: (environment) => environment.name === "client",
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        clsx: "cn",
        "tailwind-merge": "cn",
      },
    },

    build: {
      target: "esnext",
      minify: "oxc",
      cssCodeSplit: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 500,

      modulePreload: {
        resolveDependencies: (_filename, deps) => {
          // Render-path chunks only (first paint). The data layer
          // (vendor-dexie) loads on demand right after
          // paint — preloading it would contend with the critical path.
          const coreChunks = [
            "vendor-react-",
            "vendor-ts-",
            "vendor-utils",
            "vendor-baseui",
            "vendor-lucide",
            "vendor-sonner",
            "vendor-floating",
            "vendor-fuse",
            "vendor-zod",
          ];
          return deps.filter((dep) => coreChunks.some((core) => dep.includes(core)));
        },
      },

      rolldownOptions: {
        output: {
          // Vendor grouping via the supported `codeSplitting.groups` API.
          // Hard-won constraints (all verified empirically against
          // bundle-analysis-client.html, Rolldown 1.2.7):
          //  - Do NOT use the deprecated `manualChunks` fn: Rolldown ignores
          //    it whenever `codeSplitting` is also specified — and
          //    `codeSplitting: true` is the default — so `manualChunks` here
          //    is dead code that left vendor code in the entry
          //    (525KB > 500KB warning).
          //  - One NARROW group per package (static name + function test).
          //    Broad multi-package groups and string/regex tests silently
          //    capture nothing; narrow function-test groups split every
          //    time. A group that fails degrades gracefully (its package
          //    stays in the entry) — the 500KB warning is the tripwire.
          //  - Keep groups pairwise DISJOINT (verified with a script against
          //    the bundle report before adding new ones).
          // Rollup normalizes module ids to forward slashes (even on
          // Windows), so plain `includes` needles are portable.
          // `minSize: 0` materializes even tiny vendor chunks; unmatched
          // modules fall back to automatic splitting.
          codeSplitting: {
            groups: [
              { name: "vendor-sonner", test: (id) => id.includes("sonner/dist"), minSize: 0 },
              { name: "vendor-floating", test: (id) => id.includes("@floating-ui"), minSize: 0 },
              { name: "vendor-fuse", test: (id) => id.includes("fuse.js/dist"), minSize: 0 },
              { name: "vendor-utils", test: (id) => id.includes("/cn/dist"), minSize: 0 },
              { name: "vendor-zod", test: (id) => id.includes("zod/v4"), minSize: 0 },
              {
                name: "vendor-react-dom",
                test: (id) => id.includes("react-dom-client"),
                minSize: 0,
              },
              {
                name: "vendor-react-core",
                test: (id) => id.includes("react/cjs/") || id.includes("scheduler/cjs/"),
                minSize: 0,
              },
              {
                name: "vendor-ts-router-core",
                test: (id) => id.includes("router-core/dist"),
                minSize: 0,
              },
              {
                name: "vendor-ts-react-router",
                test: (id) => id.includes("react-router/dist"),
                minSize: 0,
              },
              {
                name: "vendor-ts-start",
                test: (id) => id.includes("start-client-core/dist") || id.includes("react-start-client"),
                minSize: 0,
              },
              {
                name: "vendor-ts-query",
                test: (id) => id.includes("query-core/build") || id.includes("react-query/build"),
                minSize: 0,
              },
              {
                name: "vendor-ts-misc",
                test: (id) =>
                  id.includes("@tanstack/history") ||
                  id.includes("hotkeys/dist") ||
                  id.includes("/store/dist") ||
                  id.includes("react-store/dist"),
                minSize: 0,
              },
              { name: "vendor-baseui", test: (id) => id.includes("@base-ui/"), minSize: 0 },
              { name: "vendor-lucide", test: (id) => id.includes("lucide-react/"), minSize: 0 },
              { name: "vendor-dexie", test: (id) => id.includes("/dexie/"), minSize: 0 },
            ],
          },
          minify: {
            compress: {
              dropConsole: isProduction,
              dropDebugger: isProduction,
            },
          },

          comments: {
            legal: !isProduction,
          },

          entryFileNames: (assetInfo) => {
            if (assetInfo.name === "server") {
              return "[name].js";
            }
            return "assets/[name]-[hash].js";
          },
          chunkFileNames: "assets/chunk-[name]-[hash].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.names.some((name) => name.endsWith(".css"))) {
              return "assets/[name][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
        },
      },
    },
  };
});
