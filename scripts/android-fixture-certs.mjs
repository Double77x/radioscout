/**
 * Generate the local TLS material for the Android fixture smoke.
 *
 * The private key is deliberately not committed. Every checkout generates its
 * own CA and loopback server certificate with `keytool`, the JDK tool already
 * required to build the APK. Gradle runs this before merging debug or
 * releaseTest resources and copies the CA into the generated resource tree.
 *
 * Usage:
 *   node scripts/android-fixture-certs.mjs
 *   node scripts/android-fixture-certs.mjs --ca-out android/app/build/generated/fixtureCa/res/raw/android_fixture_ca.pem
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "..", "tests", "fixtures", "android");
export const GENERATED_DIR = path.join(FIXTURE_DIR, ".generated");
export const CA_CERT_PATH = path.join(GENERATED_DIR, "fixture-ca.pem");
export const SERVER_PFX_PATH = path.join(GENERATED_DIR, "fixture-server.p12");
export const SERVER_PFX_PASSPHRASE = "radioscout-fixture";

const CA_ALIAS = "radioscout-fixture-ca";
const SERVER_ALIAS = "radioscout-fixture-server";
const CA_DNAME = "CN=RadioScout Test CA";
const SERVER_DNAME = "CN=127.0.0.1";
const SERVER_SAN = "SAN=IP:127.0.0.1,DNS:localhost";

function keytoolPath() {
  if (process.env.JAVA_HOME) {
    const executable = process.platform === "win32" ? "keytool.exe" : "keytool";
    const candidate = path.join(process.env.JAVA_HOME, "bin", executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "keytool";
}

/** @param {string} label @param {string[]} args */
function runKeytool(label, args) {
  const result = spawnSync(keytoolPath(), args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`Unable to run keytool for ${label}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`keytool failed for ${label}${detail ? `: ${detail}` : ""}`);
  }
}

function generate() {
  fs.rmSync(GENERATED_DIR, { recursive: true, force: true });
  fs.mkdirSync(GENERATED_DIR, { recursive: true, mode: 0o700 });

  const caStore = path.join(GENERATED_DIR, "ca.p12");
  const serverStore = path.join(GENERATED_DIR, "fixture-server.p12");
  const caCert = path.join(GENERATED_DIR, "fixture-ca.pem");
  const serverCert = path.join(GENERATED_DIR, "fixture-server.pem");
  const serverCsr = path.join(GENERATED_DIR, "fixture-server.csr");
  const password = SERVER_PFX_PASSPHRASE;

  runKeytool("CA key pair", [
    "-genkeypair",
    "-alias",
    CA_ALIAS,
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "3650",
    "-dname",
    CA_DNAME,
    "-ext",
    "bc:c",
    "-ext",
    "ku:c=keyCertSign,cRLSign",
    "-keystore",
    caStore,
    "-storetype",
    "PKCS12",
    "-storepass",
    password,
    "-keypass",
    password,
  ]);

  runKeytool("server key pair", [
    "-genkeypair",
    "-alias",
    SERVER_ALIAS,
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "3650",
    "-dname",
    SERVER_DNAME,
    "-ext",
    SERVER_SAN,
    "-keystore",
    serverStore,
    "-storetype",
    "PKCS12",
    "-storepass",
    password,
    "-keypass",
    password,
  ]);

  runKeytool("server certificate request", [
    "-certreq",
    "-alias",
    SERVER_ALIAS,
    "-keystore",
    serverStore,
    "-storepass",
    password,
    "-file",
    serverCsr,
  ]);

  runKeytool("server certificate", [
    "-gencert",
    "-alias",
    CA_ALIAS,
    "-keystore",
    caStore,
    "-storepass",
    password,
    "-infile",
    serverCsr,
    "-outfile",
    serverCert,
    "-rfc",
    "-validity",
    "3650",
    "-ext",
    SERVER_SAN,
    "-ext",
    "bc=ca:false",
    "-ext",
    "ku=digitalSignature,keyEncipherment",
    "-ext",
    "eku=serverAuth",
  ]);

  runKeytool("CA certificate export", [
    "-exportcert",
    "-alias",
    CA_ALIAS,
    "-keystore",
    caStore,
    "-storepass",
    password,
    "-rfc",
    "-file",
    caCert,
  ]);

  // Replace the self-signed server entry with the CA-signed reply, and carry
  // the CA in the PKCS#12 file so Node presents the full chain.
  runKeytool("CA trust entry", [
    "-importcert",
    "-alias",
    CA_ALIAS,
    "-keystore",
    serverStore,
    "-storepass",
    password,
    "-file",
    caCert,
    "-noprompt",
  ]);
  runKeytool("signed server certificate", [
    "-importcert",
    "-alias",
    SERVER_ALIAS,
    "-keystore",
    serverStore,
    "-storepass",
    password,
    "-file",
    serverCert,
    "-noprompt",
  ]);

  fs.rmSync(caStore, { force: true });
  fs.rmSync(serverCert, { force: true });
  fs.rmSync(serverCsr, { force: true });
  if (process.platform !== "win32") {
    fs.chmodSync(serverStore, 0o600);
  }
}

/**
 * Ensure the shared fixture CA and server PKCS#12 exist.
 *
 * @param {{ caOut?: string }} [options]
 * @returns {{ caCertPath: string, serverPfxPath: string, passphrase: string }}
 */
export function ensureFixtureCerts({ caOut } = {}) {
  if (!fs.existsSync(CA_CERT_PATH) || !fs.existsSync(SERVER_PFX_PATH)) {
    generate();
  }
  if (process.platform !== "win32") {
    fs.chmodSync(SERVER_PFX_PATH, 0o600);
  }
  if (caOut) {
    fs.mkdirSync(path.dirname(caOut), { recursive: true });
    fs.copyFileSync(CA_CERT_PATH, caOut);
  }
  return {
    caCertPath: CA_CERT_PATH,
    serverPfxPath: SERVER_PFX_PATH,
    passphrase: SERVER_PFX_PASSPHRASE,
  };
}

function main() {
  const args = process.argv.slice(2);
  const caOutIndex = args.indexOf("--ca-out");
  const caOut = caOutIndex === -1 ? undefined : args[caOutIndex + 1];
  if (caOutIndex !== -1 && !caOut) {
    throw new Error("--ca-out requires a path");
  }
  const paths = ensureFixtureCerts({ caOut });
  console.log(`fixture CA: ${paths.caCertPath}`);
  console.log(`fixture server: ${paths.serverPfxPath}`);
  if (caOut) console.log(`copied CA to: ${caOut}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
