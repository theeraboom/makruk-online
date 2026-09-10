(function(global){
  const THAI_LETTERS={K:'ขุน',Q:'เม็ด',B:'โคน',N:'ม้า',R:'เรือ',P:'เบี้ย'};
  const INTERNATIONAL={K:'ราชา',Q:'ราชินี',B:'บิชอป',N:'ม้า',R:'เรือ',P:'เบี้ย'};
  const base='M15 49 Q16 44 21 43 H43 Q48 44 49 49 V53 H15 Z';
  const thai={
    K:'M22 43 L24 35 H21 L25 30 H23 L28 23 Q25 18 30 15 L32 5 L34 15 Q39 18 36 23 L41 30 H39 L43 35 H40 L42 43 Z',
    Q:'M21 43 Q19 38 23 33 Q24 29 32 24 Q40 29 41 33 Q45 38 43 43 Z',
    B:'M21 43 Q22 36 26 31 Q21 26 25 20 Q28 16 32 13 Q36 16 39 20 Q43 26 38 31 Q42 36 43 43 Z',
    N:'M20 43 Q21 34 28 30 L22 29 L18 24 L23 18 L28 15 L29 7 L34 13 L39 14 Q46 20 44 29 Q41 36 44 43 Z M31 20 H34',
    R:'M19 43 L22 38 Q14 35 13 26 Q22 31 32 29 Q42 31 51 26 Q50 35 42 38 L45 43 Z M17 25 Q32 20 47 25',
    P:'M19 43 Q14 37 20 33 Q24 29 32 29 Q40 29 44 33 Q50 37 45 43 Z M22 36 Q32 32 42 36'
  };
  const staunton={
    K:'M23 43 L26 30 L22 23 V18 H29 V12 H25 V8 H29 V4 H35 V8 H39 V12 H35 V18 H42 V23 L38 30 L41 43 Z',
    Q:'M22 43 L24 31 L17 15 L25 20 L26 11 L32 19 L38 11 L39 20 L47 15 L40 31 L42 43 Z',
    B:'M23 43 L27 32 Q20 27 24 19 L32 8 L40 19 Q44 27 37 32 L41 43 Z M34 16 L29 25',
    N:thai.N,
    R:'M21 43 L23 25 L18 25 V11 H25 V17 H29 V11 H35 V17 H39 V11 H46 V25 H41 L43 43 Z',
    P:'M23 43 L27 32 Q21 29 22 22 Q23 14 32 14 Q41 14 42 22 Q43 29 37 32 L41 43 Z'
  };
  let serial=0;
  function svg(piece,game,set){
    const white=piece[0]==='w',type=piece[1],checker=game.startsWith('checkers'),outline=set==='outline',carved=set==='thai-carved';
    const id='p'+(++serial), top=white?'#fff6dc':'#748598',mid=white?'#e2cfaa':'#283749',bottom=white?'#b18b55':'#111b27',edge=white?'#735434':'#a4b8c9';
    const fill=outline?(white?'#fff8e7':'#1d2a3b'):`url(#${id})`, stroke=outline?(white?'#806541':'#aec5d6'):edge;
    const line=outline?2.2:1.15;
    let shape='';
    if(set==='thai-letters'){
      const label=checker?(type==='K'?'ฮอส':'เบี้ย'):(game==='chess-intl'?INTERNATIONAL:THAI_LETTERS)[type];
      shape=`<circle cx="32" cy="33" r="23" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="32" cy="33" r="19" fill="none" stroke="${stroke}" stroke-opacity=".45"/><text x="32" y="38" text-anchor="middle" font-family="Sarabun,sans-serif" font-weight="700" font-size="${label.length>4?13:16}" fill="${white?'#483820':'#f4e6ce'}">${label}</text>`;
    } else if(checker){
      shape=`${type==='K'?'<ellipse cx="32" cy="41" rx="23" ry="12" fill="'+fill+'" stroke="'+stroke+'"/>':''}<path d="M9 31 V39 C9 55 55 55 55 39 V31 Z" fill="${fill}" stroke="${stroke}"/><ellipse cx="32" cy="31" rx="23" ry="15" fill="${fill}" stroke="${stroke}" stroke-width="${line}"/><ellipse cx="32" cy="31" rx="18" ry="11" fill="none" stroke="${stroke}" stroke-width="${carved?2:1}"/>${type==='K'?`<path d="M23 27 L27 31 L32 23 L37 31 L41 27 L38 37 H26 Z" fill="${white?'#96713e':'#dec98f'}"/>`:`<circle cx="32" cy="31" r="4" fill="none" stroke="${stroke}"/>`}`;
    } else {
      const body=(game==='chess'?thai:staunton)[type];
      shape=`<path d="${body}" fill="${fill}" stroke="${stroke}" stroke-width="${line}" stroke-linejoin="round"/><path d="${base}" fill="${fill}" stroke="${stroke}" stroke-width="${line}"/><path d="M20 48 H44" stroke="${stroke}" opacity=".5"/>`;
      if(carved)shape+=`<path d="M26 42 Q23 38 27 36 Q31 38 32 34 Q33 38 37 36 Q41 38 38 42 M21 50 L25 47 L29 50 L32 47 L35 50 L39 47 L43 50" fill="none" stroke="${white?'#9e7947':'#d6b36b'}" stroke-width="1.2" stroke-linecap="round"/>`;
      if(!outline)shape+=`<path d="M18 51 H46" stroke="${white?'#fff9e9':'#e5eff4'}" opacity=".35" stroke-width="1.1"/>`;
    }
    return `<svg class="artisan-piece artisan-${set}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="${top}"/><stop offset=".28" stop-color="${mid}"/><stop offset=".55" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><ellipse cx="32" cy="56" rx="22" ry="4" fill="#071019" opacity=".26"/>${shape}</svg>`;
  }
  function renderPiece(piece,gameType,pieceSet='studio'){
    if(!piece)return '';
    if(pieceSet==='studio'){
      const checkers=gameType.startsWith('checkers'),index=checkers?(piece[1]==='K'?1:0):['K','Q','B','N','R','P'].indexOf(piece[1]);
      if(index<0)return '';
      const atlas=checkers?'checkers':gameType==='chess-intl'?'international':'thai';
      return `<span aria-hidden="true" class="piece-sprite sprite-${atlas}" style="background-position:${index*(checkers?100:20)}% ${piece[0]==='b'?100:0}%"></span>`;
    }
    return svg(piece,gameType,['classic','thai-carved','thai-letters','outline'].includes(pieceSet)?pieceSet:'classic');
  }
  const api={renderPiece,THAI_LETTERS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.Pieces=api;
})(typeof window!=='undefined'?window:globalThis);
