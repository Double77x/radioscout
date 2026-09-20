import fs from "node:fs";
import path from "node:path";

/**
 * Postbuild header policy. `vite build` copies `public/_headers` verbatim
 * into `dist/client`, but prebuilt HTML for dynamic routes must never be
 * cached — the markup changes with the seed catalogue while the URL stays
 * the same, so a cached copy would serve stale content indefinitely.
 *
 * Discovers every `$`-param route in `src/routes` (e.g.
 * `space.$spaceId.lazy.tsx` → `/space/*`) and appends `no-store` sections
 * to the DEPLOYED headers, so the list stays correct as routes come and go.
 * Static routes keep the global `must-revalidate` policy untouched.
 * Idempotent: `dist/` is wiped each build; a marker guard prevents doubles.
 */

const MARKER = "# Managed by scripts/apply-header-policy.js (postbuild)";
const DIST_HEADERS = path.resolve("dist", "client", "_headers");
const PUBLIC_HEADERS = path.resolve("public", "_headers");
const ROUTES_DIR = path.resolve("src", "routes");

function routeFiles(dir, base = "") {
  const entries = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push(...routeFiles(full, `${base}/${file}`));
    } else if (file.endsWith(".tsx") && !file.startsWith("__root")) {
      entries.push(`${base}/${file}`);
    }
  }
  return entries;
}

/** `space.$spaceId.lazy.tsx` → `/space/*`; index → `/`; bare `$` → skipped. */
function toDynamicPrefix(routeFile) {
  const withoutExt = routeFile.replace(/\.lazy\.tsx$/, "").replace(/\.tsx$/, "");
  const parts = withoutExt
    .split("/")
    .filter(Boolean)
    .flatMap((segment) => segment.split("."));
  if (parts.every((part) => part === "index")) return null;
  const mapped = parts.map((part) => {
    if (part === "index") return null;
    if (part.startsWith("$")) return "*";
    return part;
  });
  const urlPath = `/${mapped.filter(Boolean).join("/")}`;
  // A bare `/*` would override the global policy for every path — the
  // catch-all 404 keeps edge/browser revalidation instead.
  if (urlPath === "/*") return null;
  return mapped.includes("*") ? urlPath : null;
}

const prefixes = [
  ...new Set(
    routeFiles(ROUTES_DIR)
      .map((file) => toDynamicPrefix(file))
      .filter(Boolean),
  ),
].toSorted();

function readBaseHeaders() {
  if (fs.existsSync(DIST_HEADERS)) {
    const current = fs.readFileSync(DIST_HEADERS, "utf8");
    return current.includes(MARKER) ? current.split(MARKER)[0].trimEnd() : current.trimEnd();
  }
  return fs.readFileSync(PUBLIC_HEADERS, "utf8").trimEnd();
}

const base = readBaseHeaders();

const sections = prefixes.map((prefix) => `${prefix}\n  Cache-Control: no-store`).join("\n\n");
const output = `${base}\n\n${MARKER} — dynamic prebuilt HTML is never cached\n${sections}\n`;
fs.mkdirSync(path.dirname(DIST_HEADERS), { recursive: true });
fs.writeFileSync(DIST_HEADERS, output);
console.log(`✅ Header policy applied (${prefixes.join(", ") || "no dynamic routes"}) → ${DIST_HEADERS}`);
