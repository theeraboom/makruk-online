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

  // Set: thai-shell — เบี้ยหอย (cowrie pawn + smooth turned-wood pieces)
  const THAI_SHELL_SVG = {
    K: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="14" ry="2.5"/><path d="M6 51 Q6 47 11 46 L29 46 Q34 47 34 51 Z"/><path d="M11 45 Q14 30 20 18 Q26 30 29 45 Z"/><circle cx="20" cy="14" r="3.5"/><path d="M20 10 L20 4 M17 7 L23 7" stroke-width="1.5" fill="none"/></g></svg>',
    Q: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><path d="M12 45 Q15 32 20 24 Q25 32 28 45 Z"/><ellipse cx="20" cy="20" rx="6" ry="5"/><circle cx="20" cy="13" r="2.5"/></g></svg>',
    B: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><path d="M11 45 Q13 35 20 22 Q27 35 29 45 Z"/><path d="M11 22 Q11 12 20 10 Q29 12 29 22 Z"/></g></svg>',
    N: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><path d="M11 45 Q14 35 20 28 Q26 35 29 45 Z"/><path d="M28 28 Q32 22 28 14 Q22 8 16 12 Q12 16 14 22 Q11 24 13 28 Q15 30 18 28 L20 30 Q24 31 28 28 Z"/><circle cx="26" cy="17" r="1.2" fill="#000" stroke="none"/><path d="M16 13 L13 11" stroke-width="1.2" fill="none"/></g></svg>',
    R: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><path d="M7 51 Q7 47 12 46 L28 46 Q33 47 33 51 Z"/><path d="M12 45 Q14 32 20 25 Q26 32 28 45 Z"/><path d="M5 22 Q8 14 20 12 Q32 14 35 22 Q32 26 20 26 Q8 26 5 22 Z"/><path d="M5 22 Q8 18 12 19" fill="none" stroke-width="1.2"/><path d="M35 22 Q32 18 28 19" fill="none" stroke-width="1.2"/></g></svg>',
    P: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1.2" stroke-linejoin="round"><ellipse cx="20" cy="38" rx="14" ry="13"/><path d="M14 38 L26 38" stroke="#000" stroke-width="1.8" fill="none"/><line x1="15.5" y1="35.5" x2="15.5" y2="40.5" stroke="#000" stroke-width="0.8"/><line x1="17.5" y1="35.5" x2="17.5" y2="40.5" stroke="#000" stroke-width="0.8"/><line x1="19.5" y1="35.5" x2="19.5" y2="40.5" stroke="#000" stroke-width="0.8"/><line x1="21.5" y1="35.5" x2="21.5" y2="40.5" stroke="#000" stroke-width="0.8"/><line x1="23.5" y1="35.5" x2="23.5" y2="40.5" stroke="#000" stroke-width="0.8"/><path d="M9 32 Q14 24 20 25 Q26 24 31 32" fill="none" stroke="#000" stroke-width="0.8"/></g></svg>'
  };

  // Set: thai-temple — เจดีย์/ปราสาท (architectural temple silhouettes)
  const THAI_TEMPLE_SVG = {
    K: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="15" ry="2.5"/><rect x="5" y="44" width="30" height="6" rx="1"/><rect x="8" y="38" width="24" height="6" rx="1"/><path d="M10 38 L12 30 L28 30 L30 38 Z"/><path d="M12 30 L14 22 L26 22 L28 30 Z"/><path d="M14 22 L16 14 L24 14 L26 22 Z"/><path d="M17 14 L20 6 L23 14 Z"/><line x1="20" y1="6" x2="20" y2="1" stroke-width="1.5"/><circle cx="20" cy="2" r="1.5"/></g></svg>',
    Q: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><rect x="7" y="44" width="26" height="6" rx="1"/><rect x="10" y="38" width="20" height="6" rx="1"/><path d="M11 38 Q11 24 20 18 Q29 24 29 38 Z"/><path d="M16 18 Q16 12 20 10 Q24 12 24 18 Z"/><circle cx="20" cy="6" r="2"/></g></svg>',
    B: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><rect x="7" y="44" width="26" height="6" rx="1"/><rect x="10" y="38" width="20" height="6" rx="1"/><path d="M11 38 Q11 22 20 14 Q29 22 29 38 Z"/><circle cx="20" cy="11" r="2"/></g></svg>',
    N: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="13" ry="2.5"/><rect x="7" y="44" width="26" height="6" rx="1"/><rect x="10" y="38" width="20" height="6" rx="1"/><path d="M11 38 Q11 30 16 28 L16 22 Q12 18 16 12 Q20 8 26 12 Q32 16 30 24 L30 30 Q30 38 24 38 Z"/><circle cx="26" cy="16" r="1.2" fill="#000" stroke="none"/><path d="M17 14 L13 10" stroke-width="1.2" fill="none"/></g></svg>',
    R: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="14" ry="2.5"/><rect x="6" y="44" width="28" height="6" rx="1"/><path d="M3 36 Q5 28 20 26 Q35 28 37 36 Q35 42 20 42 Q5 42 3 36 Z"/><path d="M3 32 Q1 26 4 22 Q6 24 6 28" fill="none"/><path d="M37 32 Q39 26 36 22 Q34 24 34 28" fill="none"/><rect x="14" y="18" width="3" height="10"/><rect x="19" y="16" width="3" height="12"/><rect x="24" y="18" width="3" height="10"/></g></svg>',
    P: '<svg viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" class="ps-svg"><g fill="currentColor" stroke="#000" stroke-width="1" stroke-linejoin="round"><ellipse cx="20" cy="53" rx="12" ry="2.5"/><rect x="9" y="44" width="22" height="6" rx="1"/><path d="M20 18 Q12 26 14 38 L26 38 Q28 26 20 18 Z"/><path d="M20 18 Q14 16 12 22 Q15 24 18 22" fill="currentColor"/><path d="M20 18 Q26 16 28 22 Q25 24 22 22" fill="currentColor"/></g></svg>'
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
    if (pieceSet === 'thai-shell') {
      return THAI_SHELL_SVG[type] || '';
    }
    if (pieceSet === 'thai-temple') {
      return THAI_TEMPLE_SVG[type] || '';
    }
    if (pieceSet === 'thai-letters') {
      return `<span class="ps-letter">${THAI_LETTERS[type] || ''}</span>`;
    }
    if (pieceSet === 'outline') {
      return CHESS_OUTLINE[piece] || '';
    }
    return CHESS_UNICODE[piece] || '';
  }

  const api = { renderPiece, CHESS_UNICODE, THAI_LETTERS, THAI_SVG, THAI_SHELL_SVG, THAI_TEMPLE_SVG, CHECKERS_UNICODE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Pieces = api;
})(typeof window !== 'undefined' ? window : globalThis);
