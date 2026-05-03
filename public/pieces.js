(function (global) {
  const CHESS_UNICODE = {
    'wK': '♚', 'wQ': '♛', 'wB': '♝', 'wN': '♞', 'wR': '♜', 'wP': '♟',
    'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
  };
  const CHESS_OUTLINE = {
    'wK': '♔', 'wQ': '♕', 'wB': '♗', 'wN': '♘', 'wR': '♖', 'wP': '♙',
    'bK': '♔', 'bQ': '♕', 'bB': '♗', 'bN': '♘', 'bR': '♖', 'bP': '♙'
  };
  const THAI_LETTERS = { K: 'ขุน', Q: 'เม็ด', B: 'โคน', N: 'ม้า', R: 'เรือ', P: 'เบี้ย' };

  const THAI_SVG = {
    K: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="15" ry="2.5"/><path d="M5 51 Q5 47 10 46 L30 46 Q35 47 35 51 Z"/><ellipse cx="20" cy="45" rx="13" ry="2"/><path d="M9 44 L11 33 L29 33 L31 44 Z"/><ellipse cx="20" cy="32" rx="11" ry="2"/><path d="M11 32 L13 22 L27 22 L29 32 Z"/><ellipse cx="20" cy="21" rx="9" ry="2"/><path d="M13 21 L15 13 L25 13 L27 21 Z"/><circle cx="20" cy="11" r="4"/><line x1="20" y1="7" x2="20" y2="1" stroke-width="2"/></g></svg>',
    Q: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="15" ry="2.5"/><path d="M5 51 Q5 47 10 46 L30 46 Q35 47 35 51 Z"/><ellipse cx="20" cy="45" rx="13" ry="2"/><path d="M9 44 L13 28 L27 28 L31 44 Z"/><ellipse cx="20" cy="27" rx="11" ry="2"/><path d="M11 27 L14 16 L26 16 L29 27 Z"/><ellipse cx="20" cy="14" rx="8" ry="3"/><circle cx="20" cy="8" r="4"/></g></svg>',
    B: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="15" ry="2.5"/><path d="M5 51 Q5 47 10 46 L30 46 Q35 47 35 51 Z"/><ellipse cx="20" cy="45" rx="13" ry="2"/><path d="M9 44 L12 25 L28 25 L31 44 Z"/><ellipse cx="20" cy="24" rx="11" ry="3"/><ellipse cx="20" cy="15" rx="8" ry="9"/></g></svg>',
    N: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="15" ry="2.5"/><path d="M5 51 Q5 47 10 46 L30 46 Q35 47 35 51 Z"/><ellipse cx="20" cy="45" rx="13" ry="2"/><path d="M9 44 L12 32 L28 32 L31 44 Z"/><ellipse cx="20" cy="31" rx="11" ry="2"/><path d="M11 30 Q9 22 14 16 Q18 11 25 11 Q31 11 30 18 L30 26 Q30 30 27 30 Z"/><circle cx="25" cy="17" r="1.2" fill="#000" stroke="none"/><path d="M14 15 L11 12" stroke-width="1.5" fill="none"/></g></svg>',
    R: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="15" ry="2.5"/><path d="M5 51 Q5 47 10 46 L30 46 Q35 47 35 51 Z"/><ellipse cx="20" cy="45" rx="13" ry="2"/><path d="M9 44 L12 28 L28 28 L31 44 Z"/><ellipse cx="20" cy="27" rx="11" ry="2"/><path d="M9 26 L9 16 L13 16 L13 19 L17 19 L17 16 L23 16 L23 19 L27 19 L27 16 L31 16 L31 26 Z"/></g></svg>',
    P: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><ellipse cx="20" cy="45" rx="11" ry="2"/><path d="M11 44 L13 32 L27 32 L29 44 Z"/><ellipse cx="20" cy="31" rx="9" ry="2"/><circle cx="20" cy="24" r="7"/></g></svg>'
  };

  // Set: thai-real — หมากไทยแท้ (matches authentic Thai turned-wood set)
  const THAI_REAL_SVG = {
    K: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53.5" rx="14" ry="1.8"/><path d="M6 51 Q6 47 11 46 L29 46 Q34 47 34 51 Z"/><ellipse cx="20" cy="46" rx="13" ry="1.6"/><path d="M9 45 Q9 41 12 40 L28 40 Q31 41 31 45 Z"/><ellipse cx="20" cy="40" rx="11" ry="1.4"/><path d="M11 39 L13 33 L27 33 L29 39 Z"/><ellipse cx="20" cy="33" rx="9" ry="1.3"/><path d="M13 32 L14 26 L26 26 L27 32 Z"/><ellipse cx="20" cy="26" rx="7" ry="1.2"/><path d="M14 25 L15 20 L25 20 L26 25 Z"/><ellipse cx="20" cy="20" rx="5" ry="1.1"/><ellipse cx="20" cy="16" rx="4" ry="3.5"/><path d="M20 12 L20 4" stroke="#000" stroke-width="1.5"/><circle cx="20" cy="3" r="1.5"/></g></svg>',
    Q: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53.5" rx="13" ry="1.8"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><ellipse cx="20" cy="46" rx="12" ry="1.5"/><path d="M11 45 Q9 35 14 28 Q17 24 20 23 Q23 24 26 28 Q31 35 29 45 Z"/><ellipse cx="20" cy="22" rx="7" ry="1.5"/><ellipse cx="20" cy="17" rx="5" ry="3.5"/><circle cx="20" cy="11" r="2.5"/></g></svg>',
    B: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53.5" rx="13" ry="1.8"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><ellipse cx="20" cy="46" rx="12" ry="1.5"/><path d="M9 46 Q7 32 13 22 Q16 18 20 17 Q24 18 27 22 Q33 32 31 46 Z"/><ellipse cx="20" cy="17" rx="6" ry="1.4"/><ellipse cx="20" cy="13" rx="4.5" ry="3.5"/><circle cx="20" cy="8" r="2"/></g></svg>',
    N: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53.5" rx="13" ry="1.8"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><ellipse cx="20" cy="46" rx="12" ry="1.5"/><path d="M11 45 L13 36 L27 36 L29 45 Z"/><ellipse cx="20" cy="35" rx="9" ry="1.3"/><path d="M11 35 Q9 26 15 19 Q22 12 28 16 Q33 19 32 27 L32 31 Q30 35 25 35 Z"/><circle cx="27" cy="20" r="1.3" fill="#000" stroke="none"/><path d="M16 16 L13 11 L17 13 Z"/><path d="M14 23 L11 21" stroke-width="1" fill="none"/><path d="M13 27 L10 27" stroke-width="1" fill="none"/></g></svg>',
    R: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53.5" rx="13" ry="1.8"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><ellipse cx="20" cy="46" rx="12" ry="1.5"/><path d="M9 45 Q7 33 13 26 L27 26 Q33 33 31 45 Z"/><ellipse cx="20" cy="25" rx="10" ry="1.5"/><path d="M11 24 L13 18 L27 18 L29 24 Z"/><ellipse cx="20" cy="18" rx="7" ry="1.3"/><ellipse cx="20" cy="14" rx="5" ry="3.5"/><path d="M20 10 L20 5" stroke="#000" stroke-width="1.3"/><circle cx="20" cy="4" r="1.2"/></g></svg>',
    P: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1.2" stroke-linejoin="round"><ellipse cx="20" cy="42" rx="15" ry="2.5" opacity="0.55"/><ellipse cx="20" cy="38" rx="15" ry="13"/><ellipse cx="20" cy="38" rx="11.5" ry="10" fill="none" stroke="#000" stroke-width="0.9"/><ellipse cx="20" cy="38" rx="8" ry="6.8" fill="none" stroke="#000" stroke-width="0.9"/><ellipse cx="20" cy="38" rx="4.5" ry="3.8" fill="none" stroke="#000" stroke-width="0.9"/><circle cx="20" cy="38" r="1.5" fill="#000" stroke="none"/></g></svg>'
  };

  const CHECKERS_UNICODE = { 'wM': '⛂', 'wK': '⛃', 'bM': '⛂', 'bK': '⛃' };

  function renderPiece(piece, gameType, pieceSet) {
    if (!piece) return '';
    const type = piece[1];
    if (gameType === 'checkers' || gameType === 'checkers-intl') {
      return CHECKERS_UNICODE[piece] || '';
    }
    if (pieceSet === 'thai-carved') {
      return THAI_SVG[type] || '';
    }
    if (pieceSet === 'thai-real') {
      return THAI_REAL_SVG[type] || '';
    }
    if (pieceSet === 'thai-letters') {
      return `<span class="ps-letter">${THAI_LETTERS[type] || ''}</span>`;
    }
    if (pieceSet === 'outline') {
      return CHESS_OUTLINE[piece] || '';
    }
    return CHESS_UNICODE[piece] || '';
  }

  const api = { renderPiece, CHESS_UNICODE, THAI_LETTERS, THAI_SVG, THAI_REAL_SVG, CHECKERS_UNICODE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Pieces = api;
})(typeof window !== 'undefined' ? window : globalThis);
