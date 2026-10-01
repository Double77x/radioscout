import type { Plugin } from "vite";
import { fetchIcyTitles } from "../src/lib/radio/icy";
import type { IcyStreamInfo, IcyTitle } from "../src/lib/radio/icy";

/**
 * Dev-only ICY metadata probe. Decoding lives in `src/lib/radio/icy.ts`
 * (shared with the player); this middleware only adds dev diagnostics:
 * terminal logging, a trace array and the `meta=0` negative-path toggle.
 *
 * - GET /__icy -> test page (no app code involved).
 * - GET /__icy/probe?url=<stream>&titles=3 -> JSON, then the stream is
 *   destroyed (never downloads more than a few metadata blocks).
 *
 * `apply: "serve"` keeps it out of the production bundle and the APK.
 * HLS (.m3u8) playlists carry no ICY blocks and are out of scope.
 */

const DEFAULT_URL = "https://media-the.musicradio.com/CapitalXTRALondonMP3";
const DEFAULT_TITLES = 3;
const MAX_TITLES = 10;
const TIMEOUT_MS = 25_000;

export interface IcyProbeResult {
  ok: boolean;
  reason?: string;
  info?: IcyStreamInfo;
  titles?: IcyTitle[];
  /** Step-by-step trace, also mirrored to the dev-server terminal. */
  trace: string[];
}

async function probeStream(target: string, maxTitles: number, sendMetaHeader: boolean): Promise<IcyProbeResult> {
  const trace: string[] = [];
  const log = (message: string): void => {
    trace.push(message);
    console.log(`[icy-probe] ${message}`);
  };
  log(`GET ${target} (Icy-MetaData header ${sendMetaHeader ? "sent" : "skipped"})`);
  const { outcome, info, titles } = await fetchIcyTitles(target, {
    maxTitles,
    timeoutMs: TIMEOUT_MS,
    sendMetaHeader,
    userAgent: "RadioScoutIcyProbe/0.3 (+dev)",
    onTrace: log,
  });
  if (outcome === "complete") return { ok: true, info, titles, trace };
  if (outcome === "http-error") return { ok: false, reason: `http-${info?.status ?? "?"}`, info, trace };
  if (outcome === "no-metaint") {
    log("no icy-metaint: server sends no interleaved blocks, nothing to decode");
    return { ok: false, reason: "no-icy-metaint", info, trace };
  }
  if (outcome === "timeout") {
    const partial = titles.length > 0;
    log(`window ended with ${titles.length} titles`);
    return { ok: partial, reason: partial ? "partial" : "timeout", info, titles, trace };
  }
  log(`fetch failed (${info === undefined ? "before headers" : "mid-pump"})`);
  return { ok: false, reason: "fetch-failed", info, trace };
}

function testPage(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>ICY probe (dev only)</title></head>
<body style="font-family: system-ui; max-width: 60rem; margin: 2rem auto; padding: 0 1rem;">
<h1>ICY metadata probe</h1>
<p>Fetches a stream server-side with <code>Icy-MetaData: 1</code> and decodes the first metadata blocks. Dev only. Titles repeat until the track changes, so one distinct title still proves decoding. Every step lands in <code>trace</code> below, in this page's browser console, and in the dev-server terminal as <code>[icy-probe]</code> lines.</p>
<label>Stream URL<br><input id="url" size="80" value="${DEFAULT_URL}"></label>
<label><input id="meta" type="checkbox" checked> Send Icy-MetaData request header (untick to demo the no-metadata path)</label>
<button id="go">Probe</button>
<pre id="out">Idle.</pre>
<script>
const out = document.getElementById("out");
document.getElementById("go").onclick = async () => {
  const url = document.getElementById("url").value;
  const meta = document.getElementById("meta").checked ? "1" : "0";
  out.textContent = "Probing (up to ${TIMEOUT_MS / 1000}s)...";
  try {
    const res = await fetch("/__icy/probe?url=" + encodeURIComponent(url) + "&meta=" + meta);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
    if (data && data.trace) console.log("[icy-probe] trace:", data.trace);
  } catch (error) {
    out.textContent = "Probe request failed: " + error;
  }
};
</script>
</body>
</html>`;
}

export function icyProbe(): Plugin {
  return {
    name: "radioscout:icy-probe",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__icy/probe", (req, res) => {
        void (async () => {
          try {
            const params = new URL(req.url ?? "", "http://localhost").searchParams;
            const target = params.get("url") ?? "";
            const wanted = Number(params.get("titles") ?? DEFAULT_TITLES);
            const maxTitles = Number.isInteger(wanted) ? Math.min(Math.max(wanted, 1), MAX_TITLES) : DEFAULT_TITLES;
            const sendMetaHeader = params.get("meta") !== "0";
            if (!target.startsWith("http://") && !target.startsWith("https://")) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, reason: "http(s)-only", trace: [] }));
              return;
            }
            const result = await probeStream(target, maxTitles, sendMetaHeader);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, reason: "probe-crashed", trace: [] }));
          }
        })();
      });
      server.middlewares.use("/__icy", (_req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(testPage());
      });
    },
  };
}
