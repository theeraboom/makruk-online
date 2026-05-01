const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1200x630 OG image — Royal Night dark theme + gold accents + 4 games + AI Bot
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F172A"/>
      <stop offset="1" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FBBF24"/>
      <stop offset="0.5" stop-color="#F59E0B"/>
      <stop offset="1" stop-color="#D97706"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FBBF24" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FBBF24" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="900" cy="120" rx="450" ry="260" fill="url(#glow)"/>
  <ellipse cx="200" cy="540" rx="380" ry="220" fill="url(#glow)"/>

  <!-- Subtle decorative chess corner glyph -->
  <text x="1080" y="600" font-family="serif" font-size="240" fill="#FBBF24" opacity="0.06" text-anchor="middle">♛</text>

  <!-- Logo mark -->
  <rect x="80" y="80" width="92" height="92" rx="20" fill="url(#gold)" filter="url(#softShadow)"/>
  <text x="126" y="148" font-family="serif" font-size="62" fill="#0F172A" text-anchor="middle" font-weight="900">♛</text>

  <!-- Brand -->
  <text x="195" y="125" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="46" font-weight="700" fill="#F8FAFC">Playmakruk</text>
  <text x="195" y="160" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="22" fill="#94A3B8">หมากรุก / หมากฮอส ออนไลน์ — ฟรี ไม่ต้องสมัคร</text>

  <!-- Headline -->
  <text x="80" y="280" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="68" font-weight="700" fill="#F8FAFC">เล่นกับเพื่อน</text>
  <text x="80" y="360" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="68" font-weight="700" fill="url(#gold)">หรือ AI Bot 3 ระดับ</text>

  <!-- Subhead -->
  <text x="80" y="410" font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="24" fill="#CBD5E1">เปิดวง 2 คนเล่น • คนอื่นเข้าดู+แชทสดได้</text>

  <!-- Game pills -->
  <g font-family="'Prompt','Sarabun','Helvetica Neue',sans-serif" font-size="22" font-weight="500">
    <g transform="translate(80, 470)">
      <rect width="200" height="58" rx="29" fill="rgba(251,191,36,0.12)" stroke="#FBBF24" stroke-width="1.5"/>
      <text x="100" y="38" fill="#FBBF24" text-anchor="middle">♛ หมากรุกไทย</text>
    </g>
    <g transform="translate(295, 470)">
      <rect width="210" height="58" rx="29" fill="rgba(251,191,36,0.12)" stroke="#FBBF24" stroke-width="1.5"/>
      <text x="105" y="38" fill="#FBBF24" text-anchor="middle">♚ หมากรุกสากล</text>
    </g>
    <g transform="translate(80, 540)">
      <rect width="200" height="58" rx="29" fill="rgba(251,191,36,0.12)" stroke="#FBBF24" stroke-width="1.5"/>
      <text x="100" y="38" fill="#FBBF24" text-anchor="middle">● หมากฮอสไทย</text>
    </g>
    <g transform="translate(295, 540)">
      <rect width="210" height="58" rx="29" fill="rgba(251,191,36,0.12)" stroke="#FBBF24" stroke-width="1.5"/>
      <text x="105" y="38" fill="#FBBF24" text-anchor="middle">● หมากฮอสสากล</text>
    </g>
  </g>

  <!-- Right side: chess board mini -->
  <g transform="translate(720, 180)" filter="url(#softShadow)">
    ${(() => {
      let s = '';
      const sq = 44;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const fill = (r + c) % 2 === 0 ? '#F5E6C8' : '#A0763E';
        s += `<rect x="${c * sq}" y="${r * sq}" width="${sq}" height="${sq}" fill="${fill}"/>`;
      }
      // Pieces (Thai chess starting-ish position, simplified)
      const pieces = [
        // Black back rank
        [0,0,'♜','#1F2937'],[0,1,'♞','#1F2937'],[0,2,'♝','#1F2937'],[0,3,'♛','#1F2937'],
        [0,4,'♚','#1F2937'],[0,5,'♝','#1F2937'],[0,6,'♞','#1F2937'],[0,7,'♜','#1F2937'],
        // Black pawns row 2
        ...[0,1,2,3,4,5,6,7].map(c => [2,c,'♟','#1F2937']),
        // White pawns row 5
        ...[0,1,2,3,4,5,6,7].map(c => [5,c,'♟','#FFFFFF']),
        // White back rank
        [7,0,'♜','#FFFFFF'],[7,1,'♞','#FFFFFF'],[7,2,'♝','#FFFFFF'],[7,3,'♛','#FFFFFF'],
        [7,4,'♚','#FFFFFF'],[7,5,'♝','#FFFFFF'],[7,6,'♞','#FFFFFF'],[7,7,'♜','#FFFFFF'],
      ];
      for (const [r, c, glyph, color] of pieces) {
        s += `<text x="${c * sq + sq/2}" y="${r * sq + sq * 0.72}" font-size="${sq * 0.78}" text-anchor="middle" fill="${color}" stroke="${color === '#FFFFFF' ? '#000' : '#FFF'}" stroke-width="0.5">${glyph}</text>`;
      }
      // Border
      s += `<rect x="0" y="0" width="${sq*8}" height="${sq*8}" fill="none" stroke="#FBBF24" stroke-width="3" rx="6"/>`;
      return s;
    })()}
  </g>

  <!-- Footer URL — under chess board, bottom-right -->
  <text x="896" y="580" font-family="'Inter','Helvetica Neue',sans-serif" font-size="22" font-weight="600" fill="#FBBF24" text-anchor="middle">playmakruk.com</text>
</svg>`;

(async () => {
  const out = path.join(__dirname, '..', 'public', 'og-image.png');
  await sharp(Buffer.from(svg))
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(out);
  const size = fs.statSync(out).size;
  console.log('Wrote ' + out + ' (' + Math.round(size/1024) + ' KB)');
})();
