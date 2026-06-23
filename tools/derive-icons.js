// Derive all AlbaBiz icon assets from the chosen master (Variant 1: AB monogram).
// Run with sharp resolved from cloud/worker/node_modules.
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

const ROOT = 'C:/projects/albabiz.ie';
const MASTER = path.join(ROOT, 'assets/generated/ab-1.png');

(async () => {
  const img = sharp(MASTER);
  const meta = await img.metadata();
  console.log('MASTER', meta.width + 'x' + meta.height, meta.format);

  // Sample the top-left corner red so the Android adaptive background color
  // matches the tile exactly (no seam where the scaled foreground sits).
  const { data, info } = await sharp(MASTER).extract({ left: 4, top: 4, width: 8, height: 8 })
    .raw().toBuffer({ resolveWithObject: true });
  let r=0,g=0,b=0,n=info.width*info.height;
  for (let i=0;i<data.length;i+=info.channels){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
  r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n);
  const hex = '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
  console.log('CORNER_RED', hex, `rgb(${r},${g},${b})`);

  // Square master normalised to a clean NxN (cover crop, in case master isn't exactly square)
  const sq = (size) => sharp(MASTER).resize(size, size, { fit: 'cover', position: 'centre' });

  // ---- WEB / PLAY full-bleed square icons (rounded by the OS, not us) ----
  const webJobs = [
    ['cloud/pages/icons/icon-32.png', 32],
    ['cloud/pages/favicon-32.png', 32],
    ['cloud/pages/icons/icon-192.png', 192],
    ['cloud/pages/icons/icon-512.png', 512],
    ['cloud/pages/icons/apple-touch-icon.png', 180],
    ['play-listing/icon-512.png', 512],
  ];
  for (const [rel, size] of webJobs) {
    await sq(size).png().toFile(path.join(ROOT, rel));
    console.log('web', rel, size);
  }

  // ---- ANDROID legacy raster mipmaps (square + circle-masked round) ----
  const densities = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192 };
  for (const [d, px] of Object.entries(densities)) {
    const dir = path.join(ROOT, 'android/app/src/main/res/mipmap-' + d);
    await sq(px).png().toFile(path.join(dir, 'ic_launcher.png'));
    // round: circle mask
    const circle = Buffer.from(
      `<svg width="${px}" height="${px}"><circle cx="${px/2}" cy="${px/2}" r="${px/2}" fill="#fff"/></svg>`
    );
    await sq(px).composite([{ input: circle, blend: 'dest-in' }]).png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
    console.log('android mipmap', d, px);
  }

  // ---- ADAPTIVE foreground: AB tile scaled into the safe zone on transparent.
  // 432x432 canvas (xxxhdpi adaptive). Scale tile to ~74% so letters stay inside
  // the central ~66dp safe circle; transparent margin lets the red bg show.
  const FG = 432, inner = Math.round(FG * 0.74); // 320
  const pad = Math.round((FG - inner) / 2);
  const tile = await sq(inner).png().toBuffer();
  await sharp({ create: { width: FG, height: FG, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
    .composite([{ input: tile, top: pad, left: pad }])
    .png().toFile(path.join(ROOT, 'android/app/src/main/res/drawable/ic_launcher_foreground.png'));
  console.log('adaptive foreground 432 inner', inner);

  // ---- SPLASH icon: AB tile as a circular badge on transparent (system masks
  // the splash icon to a circle; a pre-made red disc meets the red splash bg).
  const SP = 768, disc = Math.round(SP * 0.58);
  const dpad = Math.round((SP - disc) / 2);
  const circ = Buffer.from(`<svg width="${disc}" height="${disc}"><circle cx="${disc/2}" cy="${disc/2}" r="${disc/2}" fill="#fff"/></svg>`);
  const discTile = await sq(disc).composite([{ input: circ, blend: 'dest-in' }]).png().toBuffer();
  await sharp({ create: { width: SP, height: SP, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
    .composite([{ input: discTile, top: dpad, left: dpad }])
    .png().toFile(path.join(ROOT, 'android/app/src/main/res/drawable/ic_splash.png'));
  console.log('splash 768 disc', disc);

  // Write the resolved red to a tiny file so the shell step can read it.
  fs.writeFileSync(path.join(ROOT, 'assets/generated/_corner_red.txt'), hex);
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
