/**
 * Local HTTPS stream for the Android smoke tests. It serves a looped MP3 with
 * Icecast-style `icy-metaint` metadata, so the test exercises the same native
 * path as a live station without depending on a public directory or stream.
 *
 * The CA and server certificate are generated on demand by
 * `android-fixture-certs.mjs`; no private key is committed. The debug and
 * releaseTest Android variants trust the generated CA through their network
 * security config; the shipped release does not.
 *
 * Usage (usually started by `android-smoke.mjs`):
 *   node scripts/android-fixture-server.mjs
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ensureFixtureCerts } from "./android-fixture-certs.mjs";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "..", "tests", "fixtures", "android");
const AUDIO = fs.readFileSync(path.join(FIXTURE_DIR, "live.mp3"));

/** `metaint` bytes of audio, then one Icecast metadata block. */
const METAINT = 4096;
/** One second of 32 kbps audio per tick; keeps a live stream from racing the decoder. */
const TICK_MS = 1000;
const STREAM_TITLE = "Fixture Artist - Local Test Track";
const METADATA = Buffer.from(`StreamTitle='${STREAM_TITLE}';`, "utf8");

export const FIXTURE_STATION_NAME = "Scout Local Fixture";
export const FIXTURE_PORT = 8765;
export const FIXTURE_STREAM_PATH = "/live.mp3";

/** Pad the metadata to Icecast's 16-byte block boundary. */
function metadataBlock() {
  const blocks = Math.ceil(METADATA.length / 16);
  const padded = Buffer.alloc(blocks * 16);
  METADATA.copy(padded);
  return Buffer.concat([Buffer.from([blocks]), padded]);
}

/**
 * @param {{ port?: number }} [options]
 * @returns {Promise<{ port: number, streamUrl: string, close: () => Promise<void> }>}
 */
export function startFixtureServer({ port = FIXTURE_PORT } = {}) {
  const certs = ensureFixtureCerts();
  const pfx = fs.readFileSync(certs.serverPfxPath);
  /** @type {Set<import("node:net").Socket>} */
  const sockets = new Set();
  const server = https.createServer({ pfx, passphrase: certs.passphrase }, (request, response) => {
    const pathname = new URL(request.url ?? "/", "https://127.0.0.1").pathname;
    if (pathname === "/health") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("ok");
      return;
    }
    if (pathname !== FIXTURE_STREAM_PATH) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Connection: "keep-alive",
      "icy-name": FIXTURE_STATION_NAME,
      "icy-genre": "Test",
      "icy-br": "32",
      "icy-metaint": String(METAINT),
    });

    let offset = 0;
    const timer = globalThis.setInterval(() => {
      if (response.destroyed || response.writableEnded) {
        globalThis.clearInterval(timer);
        return;
      }
      const end = Math.min(offset + METAINT, AUDIO.length);
      response.write(AUDIO.subarray(offset, end));
      offset = end === AUDIO.length ? 0 : end;
      response.write(metadataBlock());
    }, TICK_MS);

    response.on("close", () => {
      globalThis.clearInterval(timer);
    });
    response.on("error", () => {
      globalThis.clearInterval(timer);
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("fixture server has no TCP address"));
        return;
      }
      resolve({
        port: address.port,
        streamUrl: `https://127.0.0.1:${address.port}${FIXTURE_STREAM_PATH}`,
        close: () =>
          new Promise((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startFixtureServer();
  console.log(`fixture stream: ${fixture.streamUrl}`);
  console.log(`icy title: ${STREAM_TITLE}`);
  const stop = () => {
    void fixture.close().then(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
