import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// 1. Official master SVG for logo-square (512x512, solid white background, centered logo, rx=64)
const logoSquareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Solid White Background with subtle rounded corners (no transparency) -->
  <rect width="512" height="512" rx="64" fill="#ffffff" />

  <!-- Centered Papo.net.br Chat Mark -->
  <g transform="translate(56, 56) scale(0.78125)">
    <!-- Primary Speech Bubble (Deep Dark Slate #0f172a) -->
    <path d="M 256,40 C 136.7,40 40,129.5 40,240 C 40,283.6 54.8,323.9 80,356.5 L 48,464 L 162.2,425.8 C 190.8,435 C 222.4,440 256,440 C 375.3,440 472,350.5 472,240 C 472,129.5 375.3,40 256,40 Z" fill="#0f172a" />
    
    <!-- Secondary Overlay Bubble (Vibrant Emerald Green #10b981) -->
    <path d="M 320,180 C 231.6,180 160,244.5 160,324 C 160,353.8 170.2,381.3 187.8,403.6 L 164,476 L 241.6,449.9 C 265.2,456.4 291.8,460 320,460 C 408.4,460 480,395.5 480,316 C 480,236.5 408.4,180 320,180 Z" fill="#10b981" />
    
    <!-- Stylized "P" in primary bubble in Crisp White (#ffffff) -->
    <path d="M 180,120 L 250,120 C 285,120 305,138 305,168 C 305,198 285,216 250,216 L 212,216 L 212,280 L 180,280 Z M 212,148 L 212,188 L 246,188 C 264,188 273,180 273,168 C 273,156 264,148 246,148 Z" fill="#ffffff" />
    
    <!-- Chat dots in secondary bubble in White (#ffffff) -->
    <circle cx="280" cy="320" r="16" fill="#ffffff" />
    <circle cx="320" cy="320" r="16" fill="#ffffff" />
    <circle cx="360" cy="320" r="16" fill="#ffffff" />
  </g>
</svg>`;

// 2. Open Graph Banner SVG (1200x630)
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="og-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1d"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="og-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <!-- Dark Premium Background -->
  <rect width="1200" height="630" fill="url(#og-bg)"/>
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#1e293b" stroke-width="2"/>

  <!-- Logo Group -->
  <g transform="translate(100, 185)">
    <!-- White Box container for Logo -->
    <rect width="260" height="260" rx="36" fill="#ffffff" />
    <g transform="translate(28, 28) scale(0.40)">
      <path d="M 256,40 C 136.7,40 40,129.5 40,240 C 40,283.6 54.8,323.9 80,356.5 L 48,464 L 162.2,425.8 C 190.8,435 C 222.4,440 256,440 C 375.3,440 472,350.5 472,240 C 472,129.5 375.3,40 256,40 Z" fill="#0f172a" />
      <path d="M 320,180 C 231.6,180 160,244.5 160,324 C 160,353.8 170.2,381.3 187.8,403.6 L 164,476 L 241.6,449.9 C 265.2,456.4 291.8,460 320,460 C 408.4,460 480,395.5 480,316 C 480,236.5 408.4,180 320,180 Z" fill="#10b981" />
      <path d="M 180,120 L 250,120 C 285,120 305,138 305,168 C 305,198 285,216 250,216 L 212,216 L 212,280 L 180,280 Z M 212,148 L 212,188 L 246,188 C 264,188 273,180 273,168 C 273,156 264,148 246,148 Z" fill="#ffffff" />
      <circle cx="280" cy="320" r="16" fill="#ffffff" />
      <circle cx="320" cy="320" r="16" fill="#ffffff" />
      <circle cx="360" cy="320" r="16" fill="#ffffff" />
    </g>
  </g>

  <!-- Typography -->
  <text x="410" y="270" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="76" fill="#ffffff" letter-spacing="-1.5">Papo.net.br</text>
  <text x="410" y="335" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="32" fill="url(#og-accent)">Chat Online Gratuito em Tempo Real</text>
  <text x="410" y="390" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="22" fill="#94a3b8">Converse com pessoas reais em salas públicas e mensagens privadas.</text>

  <!-- Pill Badge -->
  <rect x="410" y="425" width="310" height="46" rx="23" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
  <circle cx="435" cy="448" r="6" fill="#10b981"/>
  <text x="452" y="455" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" fill="#10b981">Sem necessidade de cadastro</text>
</svg>`;

async function generate() {
  const publicDir = path.resolve('public');
  const publicIconsDir = path.resolve('public/assets/icons');
  const publicImgDir = path.resolve('public/assets/img');
  const assetsIconsDir = path.resolve('assets/icons');
  const assetsImgDir = path.resolve('assets/img');

  [publicDir, publicIconsDir, publicImgDir, assetsIconsDir, assetsImgDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const svgBuffer = Buffer.from(logoSquareSvg);

  // 1. Generate favicon.svg
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgBuffer);
  console.log('Saved favicon.svg in public/');

  // 2. Generate PNG sizes
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'mstile-150x150.png', size: 150 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
    { name: 'android-chrome-512.png', size: 512 },
    { name: 'logo-512.png', size: 512 },
    { name: 'logo-square.png', size: 512 },
  ];

  for (const item of sizes) {
    const pngBuf = await sharp(svgBuffer)
      .resize(item.size, item.size)
      .png()
      .toBuffer();
    
    fs.writeFileSync(path.join(publicDir, item.name), pngBuf);
    console.log(`Generated ${item.name} in public/`);
  }

  // Copy logo-square.png to assets/icons/ and public/assets/icons/
  const logoSquareBuf = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'logo-square.png'), logoSquareBuf);
  fs.writeFileSync(path.join(assetsIconsDir, 'logo-square.png'), logoSquareBuf);
  console.log('Saved logo-square.png in public/assets/icons/ and assets/icons/');

  // 3. Generate favicon.ico (32x32 PNG buffer)
  const ico32Buffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico32Buffer);
  console.log('Generated favicon.ico in public/');

  // 4. Generate og-image.png (1200x630) in public, public/assets/img, and assets/img
  const ogBuffer = Buffer.from(ogSvg);
  const ogPng = await sharp(ogBuffer).png().toBuffer();
  
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogPng);
  fs.writeFileSync(path.join(publicImgDir, 'og-image.png'), ogPng);
  fs.writeFileSync(path.join(assetsImgDir, 'og-image.png'), ogPng);
  console.log('Generated og-image.png in /public, /public/assets/img, /assets/img');

  // 5. Generate browserconfig.xml
  const browserconfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/mstile-150x150.png?v=5"/>
            <TileColor>#ffffff</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;
  fs.writeFileSync(path.join(publicDir, 'browserconfig.xml'), browserconfig);
  console.log('Generated browserconfig.xml in public/');

  // 6. Generate manifest files
  const manifestData = {
    "name": "Papo.net",
    "short_name": "Papo.net",
    "description": "Chat online gratuito brasileiro em tempo real.",
    "start_url": "/",
    "icons": [
      {
        "src": "/android-chrome-192x192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/android-chrome-512x512.png",
        "sizes": "512x512",
        "type": "image/png"
      }
    ],
    "theme_color": "#111111",
    "background_color": "#111111",
    "display": "standalone"
  };

  const manifestStr = JSON.stringify(manifestData, null, 2);
  fs.writeFileSync(path.join(publicDir, 'manifest.json'), manifestStr);
  fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), manifestStr);
  fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), manifestStr);
  console.log('Generated manifest.json, site.webmanifest, manifest.webmanifest in public/');
}

generate().catch(console.error);
