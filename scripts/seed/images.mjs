// Generates original demo product illustrations as WebP with sharp.
// Each image is a simple studio-style render: a soft gradient backdrop, a
// floor shadow and a stylised object drawn from basic shapes.

import sharp from 'sharp'

const W = 1200
const H = 900

function hsl(h, s, l) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`
}

// Object drawings centred on (600, 450), roughly 520px tall.
// `c` holds the palette: body, accent, dark, light.
const shapes = {
  headphones: (c) => `
    <path d="M390 520 C390 300 810 300 810 520" fill="none" stroke="${c.body}" stroke-width="44" stroke-linecap="round"/>
    <rect x="330" y="470" width="130" height="190" rx="60" fill="${c.dark}"/>
    <rect x="740" y="470" width="130" height="190" rx="60" fill="${c.dark}"/>
    <rect x="352" y="492" width="86" height="146" rx="42" fill="${c.accent}"/>
    <rect x="762" y="492" width="86" height="146" rx="42" fill="${c.accent}"/>`,
  earbuds: (c) => `
    <rect x="430" y="420" width="340" height="220" rx="110" fill="${c.light}"/>
    <rect x="430" y="420" width="340" height="80" rx="40" fill="${c.body}" opacity=".35"/>
    <circle cx="520" cy="360" r="62" fill="${c.body}"/><rect x="500" y="360" width="40" height="120" rx="20" fill="${c.body}"/>
    <circle cx="690" cy="360" r="62" fill="${c.body}"/><rect x="670" y="360" width="40" height="120" rx="20" fill="${c.body}"/>
    <circle cx="520" cy="360" r="26" fill="${c.dark}"/><circle cx="690" cy="360" r="26" fill="${c.dark}"/>`,
  speaker: (c) => `
    <rect x="430" y="230" width="340" height="440" rx="90" fill="${c.body}"/>
    <circle cx="600" cy="520" r="105" fill="${c.dark}"/><circle cx="600" cy="520" r="55" fill="${c.accent}"/>
    <circle cx="600" cy="330" r="40" fill="${c.dark}"/>
    <rect x="470" y="250" width="260" height="14" rx="7" fill="${c.light}" opacity=".5"/>`,
  watch: (c) => `
    <rect x="530" y="160" width="140" height="580" rx="50" fill="${c.dark}"/>
    <rect x="455" y="320" width="290" height="290" rx="80" fill="${c.body}"/>
    <rect x="485" y="350" width="230" height="230" rx="60" fill="#10131a"/>
    <path d="M600 400 L600 465 L650 490" stroke="${c.accent}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <rect x="745" y="420" width="22" height="80" rx="10" fill="${c.body}"/>`,
  ring: (c) => `
    <ellipse cx="600" cy="470" rx="220" ry="200" fill="none" stroke="${c.body}" stroke-width="70"/>
    <ellipse cx="600" cy="470" rx="220" ry="200" fill="none" stroke="${c.light}" stroke-width="10" opacity=".6"/>
    <rect x="585" y="255" width="30" height="20" rx="6" fill="${c.accent}"/>`,
  camera: (c) => `
    <rect x="340" y="320" width="520" height="320" rx="46" fill="${c.dark}"/>
    <rect x="340" y="320" width="520" height="80" rx="40" fill="${c.body}"/>
    <rect x="400" y="280" width="110" height="60" rx="16" fill="${c.dark}"/>
    <circle cx="600" cy="490" r="130" fill="${c.body}"/><circle cx="600" cy="490" r="96" fill="#10131a"/>
    <circle cx="600" cy="490" r="50" fill="${c.accent}" opacity=".85"/><circle cx="570" cy="460" r="16" fill="#fff" opacity=".6"/>
    <circle cx="790" cy="360" r="20" fill="${c.accent}"/>`,
  lens: (c) => `
    <rect x="450" y="250" width="300" height="420" rx="60" fill="${c.dark}"/>
    <circle cx="600" cy="370" r="95" fill="${c.body}"/><circle cx="600" cy="370" r="62" fill="#10131a"/><circle cx="600" cy="370" r="28" fill="${c.accent}"/>
    <circle cx="600" cy="560" r="60" fill="${c.body}"/><circle cx="600" cy="560" r="36" fill="#10131a"/>`,
  drone: (c) => `
    <rect x="500" y="420" width="200" height="110" rx="40" fill="${c.body}"/>
    <line x1="520" y1="440" x2="380" y2="340" stroke="${c.dark}" stroke-width="26" stroke-linecap="round"/>
    <line x1="680" y1="440" x2="820" y2="340" stroke="${c.dark}" stroke-width="26" stroke-linecap="round"/>
    <line x1="520" y1="510" x2="380" y2="600" stroke="${c.dark}" stroke-width="26" stroke-linecap="round"/>
    <line x1="680" y1="510" x2="820" y2="600" stroke="${c.dark}" stroke-width="26" stroke-linecap="round"/>
    <ellipse cx="380" cy="335" rx="110" ry="18" fill="${c.accent}" opacity=".8"/><ellipse cx="820" cy="335" rx="110" ry="18" fill="${c.accent}" opacity=".8"/>
    <ellipse cx="380" cy="595" rx="110" ry="18" fill="${c.accent}" opacity=".8"/><ellipse cx="820" cy="595" rx="110" ry="18" fill="${c.accent}" opacity=".8"/>
    <circle cx="600" cy="545" r="34" fill="#10131a"/>`,
  lamp: (c) => `
    <ellipse cx="600" cy="690" rx="160" ry="36" fill="${c.dark}"/>
    <rect x="585" y="330" width="30" height="360" rx="14" fill="${c.body}"/>
    <path d="M430 330 L770 330 L700 200 L500 200 Z" fill="${c.accent}"/>
    <ellipse cx="600" cy="335" rx="170" ry="22" fill="${c.light}" opacity=".7"/>`,
  bulb: (c) => `
    <circle cx="600" cy="380" r="170" fill="${c.accent}"/>
    <circle cx="600" cy="380" r="120" fill="${c.light}" opacity=".6"/>
    <rect x="530" y="530" width="140" height="130" rx="20" fill="${c.dark}"/>
    <rect x="530" y="560" width="140" height="14" fill="${c.body}"/><rect x="530" y="600" width="140" height="14" fill="${c.body}"/>`,
  robot: (c) => `
    <rect x="420" y="250" width="360" height="270" rx="90" fill="${c.body}"/>
    <rect x="465" y="300" width="270" height="170" rx="60" fill="#10131a"/>
    <circle cx="545" cy="385" r="28" fill="${c.accent}"/><circle cx="655" cy="385" r="28" fill="${c.accent}"/>
    <rect x="480" y="530" width="240" height="150" rx="50" fill="${c.dark}"/>
    <rect x="590" y="200" width="20" height="60" rx="10" fill="${c.dark}"/><circle cx="600" cy="195" r="20" fill="${c.accent}"/>`,
  controller: (c) => `
    <path d="M360 420 C360 330 440 300 520 330 L680 330 C760 300 840 330 840 420 L870 580 C880 650 800 690 750 620 L700 560 L500 560 L450 620 C400 690 320 650 330 580 Z" fill="${c.body}"/>
    <circle cx="480" cy="440" r="46" fill="${c.dark}"/><circle cx="480" cy="440" r="26" fill="${c.accent}"/>
    <circle cx="660" cy="500" r="40" fill="${c.dark}"/><circle cx="660" cy="500" r="22" fill="${c.accent}"/>
    <circle cx="730" cy="410" r="16" fill="${c.light}"/><circle cx="770" cy="440" r="16" fill="${c.light}"/><circle cx="730" cy="470" r="16" fill="${c.light}"/><circle cx="690" cy="440" r="16" fill="${c.light}"/>`,
  keyboard: (c) => {
    let keys = ''
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) keys += `<rect x="${372 + k * 46}" y="${385 + r * 48}" width="38" height="38" rx="8" fill="${(r + k) % 7 === 0 ? c.accent : c.light}"/>`
    return `<rect x="340" y="350" width="520" height="240" rx="30" fill="${c.dark}"/>${keys}`
  },
  backpack: (c) => `
    <path d="M470 280 C470 200 730 200 730 280" fill="none" stroke="${c.dark}" stroke-width="30"/>
    <rect x="410" y="270" width="380" height="440" rx="90" fill="${c.body}"/>
    <rect x="460" y="470" width="280" height="190" rx="50" fill="${c.dark}"/>
    <rect x="480" y="490" width="240" height="14" rx="7" fill="${c.accent}"/>
    <rect x="585" y="300" width="30" height="120" rx="15" fill="${c.accent}"/>`,
  cube: (c) => `
    <rect x="380" y="380" width="300" height="240" rx="30" fill="${c.body}"/>
    <rect x="560" y="300" width="260" height="220" rx="30" fill="${c.accent}"/>
    <rect x="460" y="250" width="220" height="170" rx="26" fill="${c.dark}"/>
    <rect x="380" y="380" width="300" height="16" fill="${c.light}" opacity=".6"/>`,
  tag: (c) => `
    <rect x="420" y="260" width="360" height="400" rx="46" fill="${c.body}"/>
    <circle cx="600" cy="330" r="30" fill="${c.dark}"/>
    <circle cx="600" cy="500" r="100" fill="${c.accent}"/><circle cx="600" cy="500" r="50" fill="${c.light}"/>`,
  charger: (c) => `
    <rect x="450" y="300" width="300" height="330" rx="60" fill="${c.body}"/>
    <rect x="515" y="230" width="30" height="90" rx="10" fill="${c.dark}"/><rect x="655" y="230" width="30" height="90" rx="10" fill="${c.dark}"/>
    <rect x="530" y="520" width="140" height="30" rx="14" fill="${c.dark}"/><rect x="530" y="570" width="140" height="30" rx="14" fill="${c.dark}"/>
    <circle cx="600" cy="420" r="30" fill="${c.accent}"/>`,
  bottle: (c) => `
    <rect x="510" y="180" width="180" height="90" rx="30" fill="${c.dark}"/>
    <rect x="470" y="260" width="260" height="440" rx="80" fill="${c.body}"/>
    <rect x="470" y="400" width="260" height="60" fill="${c.accent}"/>
    <rect x="500" y="290" width="30" height="360" rx="15" fill="${c.light}" opacity=".35"/>`,
  dumbbell: (c) => `
    <rect x="420" y="425" width="360" height="50" rx="25" fill="${c.dark}"/>
    <rect x="330" y="310" width="90" height="280" rx="30" fill="${c.body}"/><rect x="780" y="310" width="90" height="280" rx="30" fill="${c.body}"/>
    <rect x="270" y="350" width="70" height="200" rx="26" fill="${c.accent}"/><rect x="860" y="350" width="70" height="200" rx="26" fill="${c.accent}"/>`,
  roller: (c) => `
    <rect x="330" y="360" width="540" height="200" rx="100" fill="${c.body}"/>
    <ellipse cx="860" cy="460" rx="60" ry="100" fill="${c.dark}"/>
    <rect x="400" y="380" width="30" height="160" rx="15" fill="${c.accent}"/><rect x="480" y="380" width="30" height="160" rx="15" fill="${c.accent}"/><rect x="560" y="380" width="30" height="160" rx="15" fill="${c.accent}"/><rect x="640" y="380" width="30" height="160" rx="15" fill="${c.accent}"/>`,
  rower: (c) => `
    <rect x="300" y="560" width="620" height="40" rx="20" fill="${c.dark}"/>
    <circle cx="380" cy="470" r="110" fill="${c.body}"/><circle cx="380" cy="470" r="70" fill="${c.accent}" opacity=".7"/>
    <rect x="620" y="500" width="140" height="50" rx="20" fill="${c.body}"/>
    <line x1="380" y1="470" x2="640" y2="380" stroke="${c.dark}" stroke-width="14"/>`,
  kettle: (c) => `
    <path d="M440 650 L470 360 C480 300 720 300 730 360 L760 650 Z" fill="${c.body}"/>
    <path d="M470 400 C380 360 330 300 300 240" fill="none" stroke="${c.dark}" stroke-width="22" stroke-linecap="round"/>
    <path d="M730 400 C820 400 840 560 740 590" fill="none" stroke="${c.dark}" stroke-width="30"/>
    <rect x="420" y="650" width="360" height="40" rx="16" fill="${c.dark}"/>
    <circle cx="600" cy="500" r="40" fill="${c.accent}"/>`,
  probe: (c) => `
    <rect x="320" y="440" width="560" height="30" rx="15" fill="${c.light}"/>
    <rect x="720" y="415" width="170" height="80" rx="30" fill="${c.dark}"/>
    <rect x="330" y="520" width="360" height="130" rx="40" fill="${c.body}"/>
    <rect x="360" y="545" width="120" height="80" rx="16" fill="#10131a"/><text x="420" y="598" font-family="Arial" font-size="36" fill="${c.accent}" text-anchor="middle">63°</text>`,
  oven: (c) => `
    <rect x="320" y="270" width="560" height="400" rx="40" fill="${c.body}"/>
    <rect x="360" y="310" width="380" height="320" rx="24" fill="#10131a"/>
    <rect x="390" y="560" width="320" height="16" rx="8" fill="${c.accent}"/>
    <circle cx="810" cy="380" r="34" fill="${c.dark}"/><circle cx="810" cy="480" r="34" fill="${c.dark}"/><rect x="780" y="560" width="60" height="30" rx="10" fill="${c.accent}"/>`,
  scale: (c) => `
    <rect x="340" y="420" width="520" height="220" rx="40" fill="${c.body}"/>
    <rect x="360" y="400" width="480" height="40" rx="20" fill="${c.light}"/>
    <rect x="520" y="520" width="160" height="70" rx="14" fill="#10131a"/><text x="600" y="570" font-family="Arial" font-size="40" fill="${c.accent}" text-anchor="middle">250g</text>`,
  arm: (c) => `
    <rect x="330" y="640" width="220" height="40" rx="16" fill="${c.dark}"/>
    <rect x="420" y="360" width="30" height="300" rx="14" fill="${c.body}"/>
    <line x1="435" y1="370" x2="640" y2="300" stroke="${c.body}" stroke-width="30" stroke-linecap="round"/>
    <rect x="600" y="200" width="330" height="220" rx="16" fill="#10131a"/><rect x="620" y="220" width="290" height="180" rx="8" fill="${c.accent}" opacity=".6"/>`,
  tablet: (c) => `
    <rect x="390" y="190" width="420" height="540" rx="36" fill="${c.dark}"/>
    <rect x="420" y="225" width="360" height="470" rx="16" fill="${c.light}"/>
    <rect x="460" y="280" width="220" height="18" rx="9" fill="${c.body}" opacity=".7"/><rect x="460" y="320" width="280" height="14" rx="7" fill="${c.body}" opacity=".4"/><rect x="460" y="350" width="250" height="14" rx="7" fill="${c.body}" opacity=".4"/>
    <path d="M460 470 C520 420 560 540 620 470 S720 440 740 480" fill="none" stroke="${c.accent}" stroke-width="10" stroke-linecap="round"/>`,
  phone: (c) => `
    <rect x="470" y="170" width="260" height="560" rx="46" fill="${c.dark}"/>
    <rect x="490" y="200" width="220" height="500" rx="30" fill="${c.body}"/>
    <circle cx="600" cy="360" r="60" fill="${c.accent}"/>
    <rect x="530" y="470" width="140" height="16" rx="8" fill="${c.light}"/><rect x="550" y="505" width="100" height="16" rx="8" fill="${c.light}" opacity=".6"/>`,
  glasses: (c) => `
    <rect x="330" y="370" width="240" height="160" rx="70" fill="${c.accent}" opacity=".35" stroke="${c.dark}" stroke-width="22"/>
    <rect x="630" y="370" width="240" height="160" rx="70" fill="${c.accent}" opacity=".35" stroke="${c.dark}" stroke-width="22"/>
    <path d="M570 420 C590 400 610 400 630 420" fill="none" stroke="${c.dark}" stroke-width="18"/>
    <rect x="690" y="395" width="80" height="18" rx="9" fill="${c.light}"/>`,
  lock: (c) => `
    <rect x="450" y="200" width="300" height="520" rx="60" fill="${c.body}"/>
    <circle cx="600" cy="330" r="60" fill="${c.dark}"/><circle cx="600" cy="330" r="30" fill="${c.accent}"/>
    <rect x="510" y="440" width="180" height="200" rx="30" fill="${c.dark}"/>
    <circle cx="560" cy="490" r="14" fill="${c.light}"/><circle cx="640" cy="490" r="14" fill="${c.light}"/><circle cx="560" cy="540" r="14" fill="${c.light}"/><circle cx="640" cy="540" r="14" fill="${c.light}"/><circle cx="560" cy="590" r="14" fill="${c.light}"/><circle cx="640" cy="590" r="14" fill="${c.light}"/>`,
  hub: (c) => `
    <ellipse cx="600" cy="620" rx="220" ry="50" fill="${c.dark}"/>
    <path d="M380 620 L420 380 C440 280 760 280 780 380 L820 620 Z" fill="${c.body}"/>
    <ellipse cx="600" cy="360" rx="150" ry="36" fill="${c.accent}" opacity=".8"/>`,
  gimbal: (c) => `
    <rect x="560" y="420" width="80" height="300" rx="36" fill="${c.dark}"/>
    <circle cx="600" cy="400" r="46" fill="${c.body}"/>
    <path d="M600 400 L700 300" stroke="${c.body}" stroke-width="30" stroke-linecap="round"/>
    <rect x="620" y="170" width="120" height="240" rx="20" fill="#10131a" transform="rotate(35 680 290)"/>
    <circle cx="600" cy="560" r="22" fill="${c.accent}"/>`,
  solar: (c) => {
    let cells = ''
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) cells += `<rect x="${360 + k * 125}" y="${300 + r * 105}" width="115" height="95" rx="8" fill="${c.dark}"/>`
    return `<rect x="340" y="280" width="520" height="340" rx="26" fill="${c.body}"/>${cells}<rect x="360" y="630" width="200" height="70" rx="20" fill="${c.accent}"/>`
  },
  lantern: (c) => `
    <path d="M520 220 C520 160 680 160 680 220" fill="none" stroke="${c.dark}" stroke-width="22"/>
    <rect x="480" y="220" width="240" height="60" rx="20" fill="${c.dark}"/>
    <rect x="490" y="280" width="220" height="330" rx="50" fill="${c.accent}"/>
    <rect x="530" y="310" width="140" height="270" rx="40" fill="${c.light}" opacity=".7"/>
    <rect x="470" y="610" width="260" height="70" rx="24" fill="${c.dark}"/>`,
  dashcam: (c) => `
    <rect x="600" y="220" width="30" height="120" rx="12" fill="${c.dark}"/>
    <rect x="410" y="330" width="380" height="240" rx="50" fill="${c.body}"/>
    <circle cx="530" cy="450" r="80" fill="${c.dark}"/><circle cx="530" cy="450" r="46" fill="#10131a"/><circle cx="530" cy="450" r="20" fill="${c.accent}"/>
    <rect x="650" y="400" width="100" height="100" rx="16" fill="${c.dark}"/>`,
  mount: (c) => `
    <rect x="560" y="520" width="80" height="180" rx="30" fill="${c.dark}"/>
    <circle cx="600" cy="420" r="150" fill="${c.body}"/><circle cx="600" cy="420" r="100" fill="${c.accent}" opacity=".5"/><circle cx="600" cy="420" r="40" fill="${c.light}"/>`,
  pump: (c) => `
    <rect x="460" y="240" width="280" height="440" rx="60" fill="${c.body}"/>
    <rect x="505" y="300" width="190" height="110" rx="18" fill="#10131a"/><text x="600" y="372" font-family="Arial" font-size="46" fill="${c.accent}" text-anchor="middle">35</text>
    <circle cx="600" cy="500" r="40" fill="${c.dark}"/>
    <path d="M740 600 C860 600 860 700 760 720" fill="none" stroke="${c.dark}" stroke-width="18"/>`,
  headband: (c) => `
    <ellipse cx="600" cy="460" rx="300" ry="150" fill="none" stroke="${c.body}" stroke-width="90"/>
    <ellipse cx="600" cy="460" rx="300" ry="150" fill="none" stroke="${c.light}" stroke-width="6" stroke-dasharray="4 18" opacity=".7"/>
    <rect x="330" y="420" width="70" height="90" rx="20" fill="${c.accent}"/><rect x="800" y="420" width="70" height="90" rx="20" fill="${c.accent}"/>`,
  timer: (c) => `
    <path d="M470 300 L730 300 L760 620 L440 620 Z" fill="${c.body}"/>
    <rect x="430" y="270" width="340" height="50" rx="16" fill="${c.dark}"/><rect x="420" y="610" width="360" height="50" rx="16" fill="${c.dark}"/>
    <text x="600" y="490" font-family="Arial" font-weight="bold" font-size="90" fill="${c.light}" text-anchor="middle">25</text>`,
  insole: (c) => `
    <path d="M500 700 C420 700 420 560 450 450 C470 330 440 220 560 200 C660 190 690 290 680 400 C670 520 700 700 600 710 Z" fill="${c.body}"/>
    <circle cx="560" cy="300" r="30" fill="${c.accent}"/><circle cx="600" cy="400" r="26" fill="${c.accent}" opacity=".8"/><circle cx="540" cy="620" r="36" fill="${c.accent}" opacity=".7"/>`,
  grinder: (c) => `
    <rect x="530" y="200" width="140" height="80" rx="30" fill="${c.dark}"/>
    <rect x="500" y="270" width="200" height="420" rx="60" fill="${c.body}"/>
    <rect x="530" y="350" width="140" height="220" rx="30" fill="${c.light}" opacity=".5"/>`,
}

export function renderProductImage({ shape, hue, variant = 0 }) {
  const c = {
    body: hsl(hue, 18, variant === 1 ? 30 : 88),
    accent: hsl(hue, 70, 55),
    dark: hsl(hue, 22, 20),
    light: hsl(hue, 30, 96),
  }
  const bgTop = variant === 1 ? hsl(hue, 30, 92) : hsl(hue + 20, 35, 94)
  const bgBottom = variant === 1 ? hsl(hue, 25, 80) : hsl(hue - 10, 30, 84)
  const draw = (shapes[shape] || shapes.charger)(c)
  // Variant 1 is a closer "detail" crop, variant 2 a tilted lifestyle angle.
  const transform =
    variant === 1 ? 'translate(600 450) scale(1.35) translate(-600 -470)' :
    variant === 2 ? 'translate(600 470) rotate(-10) scale(0.9) translate(-600 -450)' : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
      <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <ellipse cx="600" cy="760" rx="340" ry="46" fill="url(#shadow)"/>
    <g transform="${transform}">${draw}</g>
  </svg>`
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer()
}
