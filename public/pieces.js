(function(global){
  const THAI_LETTERS={K:'ขุน',Q:'เม็ด',B:'โคน',N:'ม้า',R:'เรือ',P:'เบี้ย'};
  const INTERNATIONAL={K:'ราชา',Q:'ราชินี',B:'บิชอป',N:'ม้า',R:'เรือ',P:'เบี้ย'};
  const ENGLISH={K:'King',Q:'Queen',B:'Bishop',N:'Knight',R:'Rook',P:'Pawn'};
  const MAKRUK_ENGLISH={...ENGLISH,Q:'Met',B:'Khon'};
  const currentLanguage=()=>global.I18N?.getLang()||'th';
  function getName(piece,game,lang=currentLanguage()){
    if(!piece)return '';
    const type=piece[1];
    if(game.startsWith('checkers'))return lang==='en'?(type==='K'?'King':'Man'):(type==='K'?'ฮอส':'เบี้ย');
    const names=lang==='en'?(game==='chess'?MAKRUK_ENGLISH:ENGLISH):(game==='chess-intl'?INTERNATIONAL:THAI_LETTERS);
    return names[type]||'';
  }
  let serial=0;
  function letters(piece,game,lang){
    const white=piece[0]==='w',label=getName(piece,game,lang);
    if(!label)return '';
    const id='p'+(++serial),top=white?'#fff6dc':'#748598',mid=white?'#e2cfaa':'#283749',bottom=white?'#b18b55':'#111b27',edge=white?'#735434':'#a4b8c9';
    return `<svg class="artisan-piece artisan-thai-letters" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="${top}"/><stop offset=".28" stop-color="${mid}"/><stop offset=".55" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><ellipse cx="32" cy="56" rx="22" ry="4" fill="#071019" opacity=".26"/><circle cx="32" cy="33" r="23" fill="url(#${id})" stroke="${edge}" stroke-width="1.5"/><circle cx="32" cy="33" r="19" fill="none" stroke="${edge}" stroke-opacity=".45"/><text x="32" y="38" text-anchor="middle" font-family="Manrope,Noto Sans Thai,sans-serif" font-weight="700" font-size="${label.length>4?13:16}" ${lang==='en'&&label.length>4?'textLength="38" lengthAdjust="spacingAndGlyphs"':''} fill="${white?'#483820':'#f4e6ce'}">${label}</text></svg>`;
  }
  function renderPiece(piece,gameType,pieceSet='studio',lang=currentLanguage()){
    if(!piece)return '';
    if(pieceSet==='thai-letters')return letters(piece,gameType,lang);
    // Retired styles use the current 3D artwork.
    {
      const checkers=gameType.startsWith('checkers'),index=checkers?(piece[1]==='K'?1:0):['K','Q','B','N','R','P'].indexOf(piece[1]);
      if(index<0)return '';
      const atlas=checkers?'checkers':gameType==='chess-intl'?'international':'thai';
      return `<span aria-hidden="true" class="piece-sprite sprite-${atlas}" style="background-position:${index*(checkers?100:20)}% ${piece[0]==='b'?100:0}%"></span>`;
    }
  }
  const api={renderPiece,getName,THAI_LETTERS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.Pieces=api;
})(typeof window!=='undefined'?window:globalThis);
