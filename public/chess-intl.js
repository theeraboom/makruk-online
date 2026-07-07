(function (global) {
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function pieceColor(p) { return p ? p[0] : null; }
  function pieceType(p) { return p ? p[1] : null; }

  function initialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const back = (color) => [color+'R', color+'N', color+'B', color+'Q', color+'K', color+'B', color+'N', color+'R'];
    board[0] = back('b');
    board[7] = back('w');
    for (let c = 0; c < 8; c++) { board[1][c] = 'bP'; board[6][c] = 'wP'; }
    return board;
  }

  function getRawMoves(board, r, c, ctx) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    const type = pieceType(piece);
    const moves = [];

    function add(nr, nc) {
      if (!inBounds(nr, nc)) return false;
      const t = board[nr][nc];
      if (!t) { moves.push({ r: nr, c: nc }); return true; }
      if (pieceColor(t) !== color) moves.push({ r: nr, c: nc, capture: true });
      return false;
    }
    function ray(dr, dc) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const t = board[nr][nc];
        if (!t) moves.push({ r: nr, c: nc });
        else { if (pieceColor(t) !== color) moves.push({ r: nr, c: nc, capture: true }); break; }
        nr += dr; nc += dc;
      }
    }

    if (type === 'K') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r+dr, c+dc);
      // Castling
      if (ctx && ctx.castling && !isInCheck(board, color)) {
        const home = color === 'w' ? 7 : 0;
        if (r === home && c === 4) {
          const oppColor = color === 'w' ? 'b' : 'w';
          // King-side
          if (ctx.castling[color + 'K'] && !board[home][5] && !board[home][6]
              && board[home][7] === color + 'R'
              && !isSquareAttacked(board, home, 5, oppColor)
              && !isSquareAttacked(board, home, 6, oppColor)) {
            moves.push({ r: home, c: 6, castle: 'K' });
          }
          // Queen-side
          if (ctx.castling[color + 'Q'] && !board[home][3] && !board[home][2] && !board[home][1]
              && board[home][0] === color + 'R'
              && !isSquareAttacked(board, home, 3, oppColor)
              && !isSquareAttacked(board, home, 2, oppColor)) {
            moves.push({ r: home, c: 2, castle: 'Q' });
          }
        }
      }
    } else if (type === 'Q') {
      ray(-1,-1); ray(-1,1); ray(1,-1); ray(1,1);
      ray(-1,0); ray(1,0); ray(0,-1); ray(0,1);
    } else if (type === 'B') {
      ray(-1,-1); ray(-1,1); ray(1,-1); ray(1,1);
    } else if (type === 'N') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr, c+dc);
    } else if (type === 'R') {
      ray(-1,0); ray(1,0); ray(0,-1); ray(0,1);
    } else if (type === 'P') {
      const fwd = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      // Forward 1
      if (inBounds(r+fwd, c) && !board[r+fwd][c]) {
        moves.push({ r: r+fwd, c });
        // Forward 2 from start
        if (r === startRow && !board[r+2*fwd][c]) {
          moves.push({ r: r+2*fwd, c, doublePawn: true });
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nr = r+fwd, nc = c+dc;
        if (!inBounds(nr, nc)) continue;
        if (board[nr][nc] && pieceColor(board[nr][nc]) !== color) {
          moves.push({ r: nr, c: nc, capture: true });
        }
        // En passant
        if (ctx && ctx.enPassant && ctx.enPassant.r === nr && ctx.enPassant.c === nc) {
          moves.push({ r: nr, c: nc, capture: true, enPassant: true });
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

  // Direct attack scan. Also fixes two pawn bugs the old move-list approach had:
  // 1) a pawn's forward push counted as an "attack" (it can't capture forward)
  // 2) a pawn's diagonal attack on an EMPTY square wasn't counted — which let
  //    castling pass through a pawn-controlled square.
  const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  function isSquareAttacked(board, r, c, byColor) {
    // Knight
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const i = r + dr, j = c + dc;
      if (inBounds(i, j) && board[i][j] === byColor + 'N') return true;
    }
    // King (adjacent)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const i = r + dr, j = c + dc;
        if (inBounds(i, j) && board[i][j] === byColor + 'K') return true;
      }
    }
    // Pawn (diagonal-forward only)
    const fwd = byColor === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const i = r - fwd, j = c + dc;
      if (inBounds(i, j) && board[i][j] === byColor + 'P') return true;
    }
    // Diagonal rays: Bishop / Queen
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      let i = r + dr, j = c + dc;
      while (inBounds(i, j)) {
        const p = board[i][j];
        if (p) { if (p[0] === byColor && (p[1] === 'B' || p[1] === 'Q')) return true; break; }
        i += dr; j += dc;
      }
    }
    // Straight rays: Rook / Queen
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let i = r + dr, j = c + dc;
      while (inBounds(i, j)) {
        const p = board[i][j];
        if (p) { if (p[0] === byColor && (p[1] === 'R' || p[1] === 'Q')) return true; break; }
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

  function applyMove(board, fromR, fromC, toR, toC, special) {
    const newBoard = board.map(row => row.slice());
    let piece = newBoard[fromR][fromC];
    newBoard[toR][toC] = piece;
    newBoard[fromR][fromC] = null;
    // Castling: also move rook
    if (special && special.castle === 'K') {
      const home = pieceColor(piece) === 'w' ? 7 : 0;
      newBoard[home][5] = newBoard[home][7];
      newBoard[home][7] = null;
    } else if (special && special.castle === 'Q') {
      const home = pieceColor(piece) === 'w' ? 7 : 0;
      newBoard[home][3] = newBoard[home][0];
      newBoard[home][0] = null;
    }
    // En passant: capture pawn behind
    if (special && special.enPassant) {
      const dir = pieceColor(piece) === 'w' ? 1 : -1;
      newBoard[toR + dir][toC] = null;
    }
    // Promotion (default queen)
    if (piece === 'wP' && toR === 0) newBoard[toR][toC] = 'wQ';
    if (piece === 'bP' && toR === 7) newBoard[toR][toC] = 'bQ';
    return newBoard;
  }

  function getLegalMoves(board, r, c, ctx) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    const raw = getRawMoves(board, r, c, ctx);
    return raw.filter(m => {
      const test = applyMove(board, r, c, m.r, m.c, m);
      return !isInCheck(test, color);
    });
  }

  function hasAnyLegalMove(board, color, ctx) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && pieceColor(board[r][c]) === color) {
        if (getLegalMoves(board, r, c, ctx).length > 0) return true;
      }
    }
    return false;
  }

  function gameStatus(board, currentPlayer, ctx) {
    const inCheck = isInCheck(board, currentPlayer);
    const hasMove = hasAnyLegalMove(board, currentPlayer, ctx);
    if (!hasMove) {
      if (inCheck) return { ended: true, winner: currentPlayer === 'w' ? 'b' : 'w', reason: 'checkmate' };
      return { ended: true, winner: null, reason: 'stalemate' };
    }
    return { ended: false, inCheck };
  }

  function moveNotation(piece, from, to, capture, promoted, special) {
    const files = ['a','b','c','d','e','f','g','h'];
    if (special && special.castle === 'K') return 'O-O';
    if (special && special.castle === 'Q') return 'O-O-O';
    const fromSq = files[from.c] + (8 - from.r);
    const toSq = files[to.c] + (8 - to.r);
    const p = pieceType(piece);
    const sep = capture ? 'x' : '-';
    let str = (p === 'P' ? '' : p) + fromSq + sep + toSq;
    if (promoted) str += '=Q';
    return str;
  }

  function applyMoves(moves) {
    let board = initialBoard();
    for (const m of moves) {
      board = applyMove(board, m.from.r, m.from.c, m.to.r, m.to.c, m.special);
    }
    return board;
  }

  const api = {
    initialBoard, getRawMoves, getLegalMoves, applyMove, applyMoves,
    isInCheck, hasAnyLegalMove, gameStatus, pieceColor, pieceType, findKing, moveNotation,
    isSquareAttacked,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ChessIntl = api;
})(typeof window !== 'undefined' ? window : globalThis);
