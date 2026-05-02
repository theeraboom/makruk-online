const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1200x630 OG image — Royal Night dark + AI Bot focus
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B1220"/>
      <stop offset="1" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FCD34D"/>
      <stop offset="0.5" stop-color="#FBBF24"/>
      <stop offset="1" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDE68A"/>
      <stop offset="0.5" stop-color="#FBBF24"/>
      <stop offset="1" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="redBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#EF4444"/>
      <stop offset="1" stop-color="#B91C1C"/>
    </linearGradient>
    <radialGradient id="glowGold" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FBBF24" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#FBBF24" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aiSpotlight" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FBBF24" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#FBBF24" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.5"/>
    </filter>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="b"/>
      <feFlood flood-color="#FBBF24" flood-opacity="0.6"/>
      <feComposite in2="b" operator="in"/>
      <feComposite in="SourceGraphic"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="280" cy="380" rx="380" ry="280" fill="url(#aiSpotlight)"/>
  <ellipse cx="950" cy="180" rx="350" ry="220" fill="url(#glowGold)"/>

  <!-- Decorative giant chess piece bg -->
  <text x="1100" y="640" font-family="serif" font-size="320" fill="#FBBF24" opacity="0.05" text-anchor="middle">♞</text>

  <!-- Top: Logo + brand -->
  <rect x="60" y="50" width="78" height="78" rx="18" fill="url(#gold)" filter="url(#softShadow)"/>
  <text x="99" y="110" font-family="serif" font-size="54" fill="#0F172A" text-anchor="middle" font-weight="900">♛</text>

  <text x="158" y="90" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="38" font-weight="700" fill="#F8FAFC">Playmakruk.com</text>
  <text x="158" y="120" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="18" fill="#94A3B8">หมากรุก / หมากฮอส ออนไลน์ + วิทยุไทย — ฟรี ไม่ต้องสมัคร</text>

  <!-- "NEW" burst badge top-right -->
  <g transform="translate(1080, 90) rotate(-12)" filter="url(#softShadow)">
    ${(() => {
      // 12-point starburst
      let pts = '';
      const cx = 0, cy = 0;
      const rOuter = 75, rInner = 58;
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI * 2 * i) / 24;
        const r = i % 2 === 0 ? rOuter : rInner;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        pts += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
      }
      pts += 'Z';
      return `<path d="${pts}" fill="url(#redBadge)" stroke="#FEF3C7" stroke-width="2"/>`;
    })()}
    <text x="0" y="-10" font-family="'Prompt','Sarabun',sans-serif" font-size="20" font-weight="700" fill="#FFFFFF" text-anchor="middle">NEW</text>
    <text x="0" y="20" font-family="'Prompt','Sarabun',sans-serif" font-size="26" font-weight="800" fill="#FDE68A" text-anchor="middle">AI BOT</text>
  </g>

  <!-- Main headline: "เล่นกับ AI BOT" - HUGE -->
  <text x="60" y="240" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="44" font-weight="600" fill="#E2E8F0">เล่นหมากรุก/หมากฮอส กับ</text>

  <!-- Massive AI BOT text -->
  <text x="60" y="350" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="118" font-weight="900" fill="url(#goldText)" letter-spacing="-2">AI BOT</text>

  <!-- Custom SVG robot icon next to AI BOT -->
  <g transform="translate(440, 240)">
    <!-- Antenna -->
    <line x1="50" y1="0" x2="50" y2="18" stroke="url(#gold)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="50" cy="6" r="7" fill="url(#gold)" stroke="#FEF3C7" stroke-width="2"/>
    <!-- Head -->
    <rect x="10" y="20" width="80" height="68" rx="14" fill="url(#gold)" stroke="#FEF3C7" stroke-width="2.5" filter="url(#softShadow)"/>
    <!-- Eyes -->
    <circle cx="32" cy="48" r="9" fill="#0F172A"/>
    <circle cx="68" cy="48" r="9" fill="#0F172A"/>
    <circle cx="34" cy="46" r="3" fill="#FCD34D"/>
    <circle cx="70" cy="46" r="3" fill="#FCD34D"/>
    <!-- Mouth (small grid like LED) -->
    <rect x="36" y="68" width="28" height="6" rx="2" fill="#0F172A"/>
    <line x1="42" y1="68" x2="42" y2="74" stroke="url(#gold)" stroke-width="1"/>
    <line x1="50" y1="68" x2="50" y2="74" stroke="url(#gold)" stroke-width="1"/>
    <line x1="58" y1="68" x2="58" y2="74" stroke="url(#gold)" stroke-width="1"/>
    <!-- Side ears -->
    <rect x="2" y="40" width="8" height="22" rx="3" fill="url(#gold)" stroke="#FEF3C7" stroke-width="1.5"/>
    <rect x="90" y="40" width="8" height="22" rx="3" fill="url(#gold)" stroke="#FEF3C7" stroke-width="1.5"/>
    <!-- Body -->
    <rect x="20" y="92" width="60" height="22" rx="6" fill="url(#gold)" stroke="#FEF3C7" stroke-width="2" filter="url(#softShadow)"/>
  </g>

  <!-- Underline accent -->
  <rect x="60" y="365" width="380" height="6" rx="3" fill="url(#gold)"/>

  <!-- Difficulty levels with star indicators -->
  <g transform="translate(60, 410)" font-family="'Prompt','Sarabun',sans-serif">
    <g>
      <text x="0" y="22" font-size="22" font-weight="600" fill="#FBBF24">3 ระดับ:</text>
    </g>
    <g transform="translate(125, 0)">
      <rect width="105" height="34" rx="17" fill="rgba(34,197,94,0.18)" stroke="#22C55E" stroke-width="1.5"/>
      <text x="52" y="22" font-size="17" font-weight="600" fill="#86EFAC" text-anchor="middle">★ ง่าย</text>
    </g>
    <g transform="translate(240, 0)">
      <rect width="130" height="34" rx="17" fill="rgba(251,191,36,0.18)" stroke="#FBBF24" stroke-width="1.5"/>
      <text x="65" y="22" font-size="17" font-weight="600" fill="#FCD34D" text-anchor="middle">★★ ปานกลาง</text>
    </g>
    <g transform="translate(380, 0)">
      <rect width="115" height="34" rx="17" fill="rgba(239,68,68,0.18)" stroke="#EF4444" stroke-width="1.5"/>
      <text x="57" y="22" font-size="17" font-weight="600" fill="#FCA5A5" text-anchor="middle">★★★ ยาก</text>
    </g>
  </g>

  <!-- Subhead: or play with friends -->
  <text x="60" y="495" font-family="'Prompt','Sarabun',sans-serif" font-size="22" fill="#CBD5E1">หรือเล่นกับเพื่อน • แชทสดกับผู้ชม • ฟังวิทยุไทยขณะเล่น</text>

  <!-- 4 game pills - compact row -->
  <g font-family="'Prompt','Sarabun',sans-serif" font-size="16" font-weight="600" transform="translate(60, 525)">
    <g>
      <rect width="155" height="42" rx="21" fill="rgba(251,191,36,0.1)" stroke="#FBBF24" stroke-width="1.2"/>
      <text x="77.5" y="27" fill="#FBBF24" text-anchor="middle">♛ หมากรุกไทย</text>
    </g>
    <g transform="translate(165, 0)">
      <rect width="165" height="42" rx="21" fill="rgba(251,191,36,0.1)" stroke="#FBBF24" stroke-width="1.2"/>
      <text x="82.5" y="27" fill="#FBBF24" text-anchor="middle">♚ หมากรุกสากล</text>
    </g>
    <g transform="translate(340, 0)">
      <rect width="155" height="42" rx="21" fill="rgba(251,191,36,0.1)" stroke="#FBBF24" stroke-width="1.2"/>
      <text x="77.5" y="27" fill="#FBBF24" text-anchor="middle">● หมากฮอสไทย</text>
    </g>
    <g transform="translate(500, 0)">
      <rect width="165" height="42" rx="21" fill="rgba(251,191,36,0.1)" stroke="#FBBF24" stroke-width="1.2"/>
      <text x="82.5" y="27" fill="#FBBF24" text-anchor="middle">● หมากฮอสสากล</text>
    </g>
  </g>

  <!-- Right side: tilted chess board with mid-game position -->
  <g transform="translate(870, 195) rotate(-6)" filter="url(#softShadow)">
    ${(() => {
      let s = '';
      const sq = 36;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const fill = (r + c) % 2 === 0 ? '#F5E6C8' : '#A0763E';
        s += `<rect x="${c * sq}" y="${r * sq}" width="${sq}" height="${sq}" fill="${fill}"/>`;
      }
      // Mid-game looking position - more interesting than starting
      const pieces = [
        // Some black pieces
        [0,4,'♚','#1F2937'],[0,7,'♜','#1F2937'],
        [1,5,'♟','#1F2937'],[1,6,'♟','#1F2937'],[1,7,'♟','#1F2937'],
        [2,2,'♞','#1F2937'],[2,5,'♝','#1F2937'],
        [3,3,'♛','#1F2937'],[3,4,'♟','#1F2937'],
        // White pieces
        [4,4,'♙','#FFFFFF'],[4,2,'♗','#FFFFFF'],
        [5,3,'♘','#FFFFFF'],
        [6,0,'♙','#FFFFFF'],[6,1,'♙','#FFFFFF'],[6,5,'♙','#FFFFFF'],[6,6,'♙','#FFFFFF'],[6,7,'♙','#FFFFFF'],
        [7,0,'♖','#FFFFFF'],[7,4,'♔','#FFFFFF'],[7,7,'♖','#FFFFFF'],
      ];
      for (const [r, c, glyph, color] of pieces) {
        s += `<text x="${c * sq + sq/2}" y="${r * sq + sq * 0.74}" font-size="${sq * 0.82}" text-anchor="middle" fill="${color}">${glyph}</text>`;
      }
      // Highlight the queen attacking move with gold tint
      s += `<rect x="${3*sq}" y="${3*sq}" width="${sq}" height="${sq}" fill="rgba(251,191,36,0.4)" stroke="#FBBF24" stroke-width="2.5"/>`;
      s += `<text x="${3*sq + sq/2}" y="${3*sq + sq*0.74}" font-size="${sq*0.82}" text-anchor="middle" fill="#1F2937">♛</text>`;
      // Border
      s += `<rect x="0" y="0" width="${sq*8}" height="${sq*8}" fill="none" stroke="#FBBF24" stroke-width="4" rx="6"/>`;
      return s;
    })()}
  </g>

  <!-- VS battery icon between left text and right board (tiny robot vs king) -->
  <!-- Already covered by AI BOT 🤖 emoji -->

  <!-- Footer URL — bottom right under board -->
  <text x="990" y="595" font-family="'Inter','Helvetica Neue',sans-serif" font-size="20" font-weight="700" fill="#FBBF24" text-anchor="middle">▶ playmakruk.com</text>
</svg>`;

(async () => {
  const out = path.join(__dirname, '..', 'public', 'og-image.png');
  await sharp(Buffer.from(svg))
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(out);
  const size = fs.statSync(out).size;
  console.log('Wrote ' + out + ' (' + Math.round(size/1024) + ' KB)');
})();
