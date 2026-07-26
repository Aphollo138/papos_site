import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Create SVG strings for icons with black background and crisp white Papo logo
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" rx="22" fill="#000000"/>
  <mask id="logo-mask-gen">
    <rect x="0" y="0" width="100" height="100" fill="white" />
    <line x1="18" y1="74" x2="78" y2="26" stroke="black" stroke-width="10" stroke-linecap="round" />
  </mask>
  <g mask="url(#logo-mask-gen)">
    <path d="M 50,14 A 36,36 0 1,1 24.5,75.5 L 14,86 L 28.5,79.5 A 36,36 0 0,1 50,14 Z M 50,22 A 28,28 0 1,0 50,78 A 28,28 0 1,0 50,22 Z" fill-rule="evenodd" fill="#ffffff" />
    <path d="M 35,66 L 45,32 L 62,32 C 70,32 70,49 60,49 L 47,49 L 42,66 Z M 49,39 L 56,39 C 60,39 60,44 56,44 L 47,44 Z" fill-rule="evenodd" fill="#ffffff" />
  </g>
  <line x1="18" y1="74" x2="78" y2="26" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none" />
  <circle cx="78" cy="26" r="6" fill="#ffffff" />
</svg>
`;

// Create SVG for Open Graph image (1200x630)
const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#141419"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00e676"/>
      <stop offset="100%" stop-color="#00b0ff"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Subtle border accent -->
  <rect x="20" y="20" width="1160" height="590" rx="24" fill="none" stroke="#26262e" stroke-width="2"/>

  <!-- Logo Group -->
  <g transform="translate(100, 215)">
    <rect width="200" height="200" rx="44" fill="#000000" stroke="#33333f" stroke-width="3"/>
    <g transform="translate(20, 20) scale(1.6)">
      <mask id="og-logo-mask">
        <rect x="0" y="0" width="100" height="100" fill="white" />
        <line x1="18" y1="74" x2="78" y2="26" stroke="black" stroke-width="10" stroke-linecap="round" />
      </mask>
      <g mask="url(#og-logo-mask)">
        <path d="M 50,14 A 36,36 0 1,1 24.5,75.5 L 14,86 L 28.5,79.5 A 36,36 0 0,1 50,14 Z M 50,22 A 28,28 0 1,0 50,78 A 28,28 0 1,0 50,22 Z" fill-rule="evenodd" fill="#ffffff" />
        <path d="M 35,66 L 45,32 L 62,32 C 70,32 70,49 60,49 L 47,49 L 42,66 Z M 49,39 L 56,39 C 60,39 60,44 56,44 L 47,44 Z" fill-rule="evenodd" fill="#ffffff" />
      </g>
      <line x1="18" y1="74" x2="78" y2="26" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none" />
      <circle cx="78" cy="26" r="6" fill="#ffffff" />
    </g>
  </g>

  <!-- Text Content -->
  <text x="340" y="280" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="68" fill="#ffffff" letter-spacing="-1">Papo.net.br</text>
  <text x="340" y="340" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="url(#accent)">Bate-Papo Online Gratuito em Tempo Real</text>
  <text x="340" y="395" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="22" fill="#a1a1aa">Converse com pessoas reais em salas públicas e mensagens privadas.</text>

  <!-- Badge -->
  <rect x="340" y="430" width="280" height="42" rx="21" fill="#18181b" stroke="#00e676" stroke-width="1.5"/>
  <circle cx="362" cy="451" r="5" fill="#00e676"/>
  <text x="378" y="458" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600" fill="#00e676">Sem necessidade de cadastro</text>
</svg>
`;

async function generate() {
  const publicDir = path.resolve('public');
  const assetsImgDir = path.resolve('assets/img');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(assetsImgDir)) fs.mkdirSync(assetsImgDir, { recursive: true });

  const svgBuffer = Buffer.from(iconSvg);

  // 1. Generate PNG sizes
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
    { name: 'logo-512.png', size: 512 },
  ];

  for (const item of sizes) {
    await sharp(svgBuffer)
      .resize(item.size, item.size)
      .png()
      .toFile(path.join(publicDir, item.name));
    console.log(`Generated ${item.name}`);
  }

  // 2. Generate favicon.ico (32x32 PNG inside ico structure or standard ICO)
  const ico32Buffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico32Buffer);
  console.log('Generated favicon.ico');

  // 3. Generate og-image.png (1200x630) in public and assets/img
  const ogBuffer = Buffer.from(ogSvg);
  const ogPng = await sharp(ogBuffer).png().toBuffer();
  
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogPng);
  fs.writeFileSync(path.join(assetsImgDir, 'og-image.png'), ogPng);
  console.log('Generated og-image.png in /public and /assets/img');
}

generate().catch(console.error);
