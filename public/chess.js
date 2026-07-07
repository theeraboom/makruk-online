(function (global) {
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function pieceColor(p) { return p ? p[0] : null; }
  function pieceType(p) { return p ? p[1] : null; }

  function initialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const blackBack = ['bR', 'bN', 'bB', 'bK', 'bQ', 'bB', 'bN', 'bR'];
    const whiteBack = ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'];
    for (let c = 0; c < 8; c++) {
      board[0][c] = blackBack[c];
      board[2][c] = 'bP';
      board[5][c] = 'wP';
      board[7][c] = whiteBack[c];
    }
    return board;
  }

  function getRawMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    const type = pieceType(piece);
    const moves = [];

    function add(nr, nc) {
      if (!inBounds(nr, nc)) return;
      const target = board[nr][nc];
      if (!target) { moves.push({ r: nr, c: nc, capture: false }); return; }
      if (pieceColor(target) !== color) moves.push({ r: nr, c: nc, capture: true });
    }
    function ray(dr, dc) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const t = board[nr][nc];
        if (!t) moves.push({ r: nr, c: nc, capture: false });
        else { if (pieceColor(t) !== color) moves.push({ r: nr, c: nc, capture: true }); break; }
        nr += dr; nc += dc;
      }
    }

    if (type === 'K') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
    } else if (type === 'Q') {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) add(r + dr, c + dc);
    } else if (type === 'B') {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) add(r + dr, c + dc);
      add(r + (color === 'w' ? -1 : 1), c);
    } else if (type === 'N') {
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(r + dr, c + dc);
    } else if (type === 'R') {
      ray(-1, 0); ray(1, 0); ray(0, -1); ray(0, 1);
    } else if (type === 'P') {
      const fwd = color === 'w' ? -1 : 1;
      if (inBounds(r + fwd, c) && !board[r + fwd][c]) moves.push({ r: r + fwd, c, capture: false });
      for (const dc of [-1, 1]) {
        const nr = r + fwd, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] && pieceColor(board[nr][nc]) !== color) {
          moves.push({ r: nr, c: nc, capture: true });
        }
      }
    }
    return moves;
  }

  function findKing(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] === color + 'K') return { r, c };
    }
    return null;
  }

  // Direct attack scan — O(rays) instead of generating move lists for all 64
  // squares. This is the hottest path (called per candidate move via isInCheck).
  const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  function isSquareAttacked(board, r, c, byColor) {
    // Knight
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const i = r + dr, j = c + dc;
      if (inBounds(i, j) && board[i][j] === byColor + 'N') return true;
    }
    // Short range: King (8 adjacent), Met/Khon (diagonal 1), Khon straight-forward, Pawn diagonal-forward
    const fwd = byColor === 'w' ? -1 : 1; // byColor's forward direction
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const i = r + dr, j = c + dc;
        if (!inBounds(i, j)) continue;
        const p = board[i][j];
        if (!p || p[0] !== byColor) continue;
        const t = p[1];
        if (t === 'K') return true;
        const diag = dr !== 0 && dc !== 0;
        // piece at (i,j) attacks (r,c) "forward" when dr === -fwd
        if (diag && (t === 'Q' || t === 'B')) return true;
        if (diag && dr === -fwd && t === 'P') return true;
        if (!diag && dc === 0 && dr === -fwd && t === 'B') return true;
      }
    }
    // Rook rays
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let i = r + dr, j = c + dc;
      while (inBounds(i, j)) {
        const p = board[i][j];
        if (p) { if (p[0] === byColor && p[1] === 'R') return true; break; }
        i += dr; j += dc;
      }
    }
    return false;
  }

  function isInCheck(board, color) {
    const k = findKing(board, color);
    if (!k) return false;
    return isSquareAttacked(board, k.r, k.c, color === 'w' ? 'b' : 'w');
  }

  function applyMove(board, fromR, fromC, toR, toC) {
    const newBoard = board.map(row => row.slice());
    const piece = newBoard[fromR][fromC];
    newBoard[toR][toC] = piece;
    newBoard[fromR][fromC] = null;
    if (piece === 'wP' && toR === 2) newBoard[toR][toC] = 'wQ';
    if (piece === 'bP' && toR === 5) newBoard[toR][toC] = 'bQ';
    return newBoard;
  }

  function getLegalMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    const raw = getRawMoves(board, r, c);
    return raw.filter(m => {
      const test = applyMove(board, r, c, m.r, m.c);
      return !isInCheck(test, color);
    });
  }

  function hasAnyLegalMove(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && pieceColor(board[r][c]) === color) {
        if (getLegalMoves(board, r, c).length > 0) return true;
      }
    }
    return false;
  }

  function gameStatus(board, currentPlayer) {
    const inCheck = isInCheck(board, currentPlayer);
    const hasMove = hasAnyLegalMove(board, currentPlayer);
    if (!hasMove) {
      if (inCheck) return { ended: true, winner: currentPlayer === 'w' ? 'b' : 'w', reason: 'checkmate' };
      return { ended: true, winner: null, reason: 'stalemate' };
    }
    return { ended: false, inCheck };
  }

  function applyMoves(moves) {
    let board = initialBoard();
    for (const m of moves) {
      board = applyMove(board, m.from.r, m.from.c, m.to.r, m.to.c);
    }
    return board;
  }

  function moveNotation(piece, from, to, capture, promoted) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromSq = files[from.c] + (8 - from.r);
    const toSq = files[to.c] + (8 - to.r);
    const p = pieceType(piece);
    const sep = capture ? 'x' : '-';
    let str = (p === 'P' ? '' : p) + fromSq + sep + toSq;
    if (promoted) str += '=Q';
    return str;
  }

  const api = {
    initialBoard, getRawMoves, getLegalMoves, applyMove, applyMoves, isInCheck,
    hasAnyLegalMove, gameStatus, pieceColor, pieceType, findKing, moveNotation
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Chess = api;
})(typeof window !== 'undefined' ? window : globalThis);
