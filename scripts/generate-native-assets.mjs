import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

/**
 * Capacitor native artwork, composited from the committed PWA mark
 * (`public/logo.svg` — transparent glass music note).
 *
 * - icon-background/icon-foreground → Android adaptive icon (key art inside
 *   the central ~62% so masks never crop the robot).
 * - icon.png → legacy launcher + Play Store source (opaque moss tile).
 * - splash.png → launch splash on paper (matches theme background).
 *
 * Run: `pnpm cap:assets` (this script + `capacitor/assets generate`).
 */
const MOSS = "#257a4b";
const PAPER = "#eef1eb";

const solid = (size, color) => ({
  create: { width: size, height: size, channels: 4, background: color },
});

async function main() {
  await mkdir("assets", { recursive: true });
  const mark = await readFile("public/logo.svg");
  const art = (size) => sharp(mark).resize(size, size).png().toBuffer();

  // Adaptive background: full-bleed moss.
  await sharp(solid(1024, MOSS)).png().toFile("assets/icon-background.png");

  // Adaptive foreground: robot at ~62%, centred on transparency.
  const foreground = await art(640);
  await sharp(solid(1024, "#00000000"))
    .composite([{ input: foreground, left: 192, top: 192 }])
    .png()
    .toFile("assets/icon-foreground.png");

  // Legacy / store icon: opaque moss tile, robot at 75%.
  const legacy = await art(768);
  await sharp(solid(1024, MOSS))
    .composite([{ input: legacy, left: 128, top: 128 }])
    .png()
    .toFile("assets/icon.png");

  // Splash: paper field, robot at ~30%.
  const splashArt = await art(820);
  await sharp(solid(2732, PAPER))
    .composite([{ input: splashArt, left: 956, top: 956 }])
    .png()
    .toFile("assets/splash.png");

  console.log("✓ assets/icon.png, icon-foreground.png, icon-background.png, splash.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
