import sharp from "sharp";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execSync } from "node:child_process";

/**
 * Capacitor native artwork, composited from the committed PWA mark
 * (`public/logo.svg` — transparent glass music note).
 *
 * - icon-background → adaptive background (dark tile matching the in-app
 *   logo tile: SettingsMenu `bg-neutral-900`).
 * - icon-foreground → adaptive foreground (note at ~69%, centred on
 *   transparency; fills the mask safe zone, extreme circle masks may
 *   graze the sparkle tips).
 * - icon.png → legacy launcher (opaque dark tile, note at 75%).
 * - splash.png → launch splash on the dark tile (the mark is the silver
 *   live logo — it needs the dark field, same as the launcher).
 * - ic_launcher_monochrome.png → Android 13+ themed-icon glyph (white
 *   silhouette keyed off the mark's own alpha).
 *
 * Run: `pnpm cap:assets`. The script composites `assets/*.png`, shells out
 * to `capacitor/assets generate` for density slicing, then patches the
 * adaptive XMLs (background as @color, monochrome layer) and removes two
 * stale template vectors (teal grid background, robot foreground) that the
 * slicer never owns. Fully re-runnable.
 */
const DARK = "#171717";

const RES = "android/app/src/main/res";
const ANYDPI = `${RES}/mipmap-anydpi-v26`;

const solid = (size, color) => ({
  create: { width: size, height: size, channels: 4, background: color },
});

const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;

const BACKGROUND_COLOR_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${DARK}</color>
</resources>
`;

async function main() {
  await mkdir("assets", { recursive: true });
  const mark = await readFile("public/logo.svg");
  const art = (size) => sharp(mark).resize(size, size).png().toBuffer();

  // Adaptive background: full-bleed dark tile.
  await sharp(solid(1024, DARK)).png().toFile("assets/icon-background.png");

  // Adaptive foreground: note at ~69%, centred on transparency.
  const foreground = await art(704);
  await sharp(solid(1024, "#00000000"))
    .composite([{ input: foreground, left: 160, top: 160 }])
    .png()
    .toFile("assets/icon-foreground.png");

  // Legacy icon: opaque dark tile, note at 82%.
  const legacy = await art(840);
  await sharp(solid(1024, DARK))
    .composite([{ input: legacy, left: 92, top: 92 }])
    .png()
    .toFile("assets/icon.png");

  // Splash: dark field, note at ~30% (silver mark needs the dark tile).
  const splashArt = await art(820);
  await sharp(solid(2732, DARK))
    .composite([{ input: splashArt, left: 956, top: 956 }])
    .png()
    .toFile("assets/splash.png");

  console.log("✓ assets/icon.png, icon-foreground.png, icon-background.png, splash.png");

  // Density slicing into android res.
  execSync("npx @capacitor/assets generate --android", { stdio: "inherit" });

  // Themed-icon glyph: white silhouette from the mark's own alpha.
  const monoArt = await art(432);
  const { data: alpha, info } = await sharp(monoArt)
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: info.width, height: info.height, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .toFile(`${RES}/drawable/ic_launcher_monochrome.png`);

  // Adaptive layers: dark @color background + monochrome. The slicer
  // rewrites these XMLs on every run (with PNG background + inset shrink),
  // so this patch must stay after it.
  await writeFile(`${RES}/values/ic_launcher_background.xml`, BACKGROUND_COLOR_XML);
  await writeFile(`${ANYDPI}/ic_launcher.xml`, ADAPTIVE_XML);
  await writeFile(`${ANYDPI}/ic_launcher_round.xml`, ADAPTIVE_XML);

  // Stale template vectors the slicer never owns: teal grid background and
  // the default robot foreground.
  await rm(`${RES}/drawable/ic_launcher_background.xml`, { force: true });
  await rm(`${RES}/drawable-v24/ic_launcher_foreground.xml`, { force: true });

  console.log("✓ adaptive XMLs patched, monochrome glyph written, stale vectors removed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
