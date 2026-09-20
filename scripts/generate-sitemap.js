import fs from "fs";
import path from "path";

const SITE_URL = "https://scout.danread.gq";
const ROUTES_DIR = path.resolve("src", "routes");
const OUTPUT_PATH = path.resolve("public", "sitemap.xml");
const toolPaths = new Set();

/**
 * Programmatically discover routes from the src/routes directory.
 * Each entry carries the mtime of its source file so the sitemap can track
 * which routes actually changed since the last build.
 */
const getRoutes = (dir, baseRoute = "") => {
  let results = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = [...results, ...getRoutes(fullPath, `${baseRoute}/${file}`)];
    } else {
      const normalizedFile = file.toLowerCase();
      if (!file.startsWith("__root") && !/admin/iu.test(normalizedFile)) {
        const routePath = file.replace(".lazy.tsx", "").replace(".tsx", "").replace("index", "");
        const finalPath = `${baseRoute}/${routePath}`.replaceAll(/\/+/gu, "/").replace(/^$/u, "/");

        let priority = "0.5";
        let changefreq = "weekly";

        if (finalPath === "/") {
          priority = "1.0";
          changefreq = "daily";
        } else if (/\/legal/iu.test(finalPath)) {
          priority = "0.3";
          changefreq = "monthly";
        } else if (toolPaths.has(finalPath)) {
          priority = "0.9";
        }

        results.push({
          path: finalPath === "/" ? "/" : finalPath,
          priority,
          changefreq,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }

  return results;
};

/**
 * Read the existing sitemap and index lastmod values by <loc> path.
 */
const readExistingLastmods = () => {
  const map = new Map();
  if (!fs.existsSync(OUTPUT_PATH)) return map;
  const xml = fs.readFileSync(OUTPUT_PATH, "utf8");
  const urlRegex = /<url>(?<block>[\s\S]*?)<\/url>/gu;
  const locRegex = /<loc>(?<loc>\S+)<\/loc>/u;
  const lastmodRegex = /<lastmod>(?<lastmod>\S+)<\/lastmod>/u;
  for (const match of xml.matchAll(urlRegex)) {
    const block = match.groups.block;
    const loc = block.match(locRegex)?.groups.loc;
    const lastmod = block.match(lastmodRegex)?.groups.lastmod;
    if (loc) map.set(loc, lastmod ?? "");
  }
  return map;
};

const generateSitemap = () => {
  console.log("🔍 Scanning routes directory...");
  const routes = getRoutes(ROUTES_DIR);
  const existing = readExistingLastmods();
  const today = new Date().toISOString().split("T")[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const route of routes) {
    const loc = `${SITE_URL}${route.path}`;
    const prevLastmod = existing.get(loc);
    const lastmod = prevLastmod || today;

    xml += "  <url>\n";
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += "  </url>\n";
  }

  xml += "</urlset>";

  fs.writeFileSync(OUTPUT_PATH, xml);
  console.log(`✅ Programmatic Sitemap generated (${routes.length} routes) at ${OUTPUT_PATH}`);
};

generateSitemap();
