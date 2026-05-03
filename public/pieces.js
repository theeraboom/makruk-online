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
    if (pieceSet === 'thai-letters') {
      return `<span class="ps-letter">${THAI_LETTERS[type] || ''}</span>`;
    }
    if (pieceSet === 'outline') {
      return CHESS_OUTLINE[piece] || '';
    }
    return CHESS_UNICODE[piece] || '';
  }

  const api = { renderPiece, CHESS_UNICODE, THAI_LETTERS, THAI_SVG, CHECKERS_UNICODE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Pieces = api;
})(typeof window !== 'undefined' ? window : globalThis);
