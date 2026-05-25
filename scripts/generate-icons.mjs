/**
 * Regenerates app icons from assets/icon.svg
 * Usage: node scripts/generate-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SVG_PATH = path.join(ROOT, "assets", "icon.svg");

const PNG_OUT = path.join(ROOT, "assets", "icons", "png");
const WIN_OUT = path.join(ROOT, "assets", "icons", "win", "icon.ico");
const MAC_OUT = path.join(ROOT, "assets", "icons", "mac", "icon.icns");

const PNG_SIZES = [
  [16, "icon_16x16.png"],
  [32, "icon_32x32.png"],
  [64, "icon_64x64.png"],
  [128, "icon_128x128.png"],
  [256, "icon_256x256.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_1024x1024.png"],
];

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function renderPng(size) {
  return sharp(SVG_PATH, { density: Math.max(72, Math.ceil((size / 100) * 288)) })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error("Missing assets/icon.svg");
    process.exit(1);
  }

  fs.mkdirSync(PNG_OUT, { recursive: true });
  fs.mkdirSync(path.dirname(WIN_OUT), { recursive: true });
  fs.mkdirSync(path.dirname(MAC_OUT), { recursive: true });

  console.log("[generate-icons] Rendering PNG sizes…");
  const rendered = new Map();
  for (const [size, name] of PNG_SIZES) {
    const buf = await renderPng(size);
    rendered.set(size, buf);
    const out = path.join(PNG_OUT, name);
    fs.writeFileSync(out, buf);
    console.log("  ", name);
  }

  const icon512 = rendered.get(512);
  const icon1024 = rendered.get(1024);

  const copies = [
    [icon512, path.join(ROOT, "assets", "icon.png")],
    [icon512, path.join(ROOT, "src", "components", "icon.png")],
  ];

  for (const [buf, dest] of copies) {
    if (buf) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      console.log("[generate-icons] Wrote", path.relative(ROOT, dest));
    }
  }

  const rendererPublic = path.join(ROOT, "renderer", "public");
  if (fs.existsSync(rendererPublic)) {
    const toIcoMod = await import("to-ico");
    const toIcoEarly = toIcoMod.default ?? toIcoMod;
    const faviconBuf = await toIcoEarly([
      await renderPng(16),
      await renderPng(32),
      await renderPng(48),
    ]);
    fs.writeFileSync(path.join(rendererPublic, "favicon.ico"), faviconBuf);
    console.log("[generate-icons] Wrote renderer/public/favicon.ico");
  }

  // macOS menu bar template (black glyph, transparent background)
  const templateBuf = await sharp(SVG_PATH, { density: 288 })
    .resize(44, 44, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  for (const dest of [
    path.join(ROOT, "assets", "iconTemplate.png"),
    path.join(ROOT, "src", "components", "iconTemplate.png"),
  ]) {
    fs.writeFileSync(dest, templateBuf);
    console.log("[generate-icons] Wrote", path.relative(ROOT, dest));
  }

  console.log("[generate-icons] Building ICO…");
  const icoBuffers = await Promise.all(ICO_SIZES.map((s) => renderPng(s)));
  const toIcoMod = await import("to-ico");
  const toIco = toIcoMod.default ?? toIcoMod;
  fs.writeFileSync(WIN_OUT, await toIco(icoBuffers));
  console.log("[generate-icons] Wrote", path.relative(ROOT, WIN_OUT));

  console.log("[generate-icons] Building ICNS (png2icons)…");
  const tmp1024 = path.join(PNG_OUT, "_gen_1024.png");
  fs.writeFileSync(tmp1024, icon1024);
  try {
    execSync(
      `npx --yes png2icons@${process.env.PNG2ICONS_VERSION || "2.0.1"} "${tmp1024}" "${path.join(path.dirname(MAC_OUT), "icon")}" -icns`,
      { cwd: ROOT, stdio: "inherit", shell: true },
    );
    const generated = path.join(path.dirname(MAC_OUT), "icon.icns");
    if (fs.existsSync(generated)) {
      fs.copyFileSync(generated, MAC_OUT);
    }
  } catch (e) {
    console.warn("[generate-icons] png2icons failed, copying largest PNG as fallback for .icns");
    fs.copyFileSync(path.join(PNG_OUT, "icon_512x512.png"), MAC_OUT);
  } finally {
    if (fs.existsSync(tmp1024)) fs.unlinkSync(tmp1024);
  }

  for (const dest of [
    path.join(ROOT, "assets", "icon.icns"),
    path.join(ROOT, "assets", "momor.icns"),
  ]) {
    fs.copyFileSync(MAC_OUT, dest);
    console.log("[generate-icons] Wrote", path.relative(ROOT, dest));
  }

  console.log("[generate-icons] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
