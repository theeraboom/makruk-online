(function (global) {
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function pieceColor(p) { return p ? p[0] : null; }
  function pieceType(p) { return p ? p[1] : null; }

  function initialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 1) continue;
        if (r < 2) board[r][c] = 'bM';
        else if (r > 5) board[r][c] = 'wM';
      }
    }
    return board;
  }

  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function getCaptureMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    const isKing = pieceType(piece) === 'K';
    const moves = [];

    for (const [dr, dc] of DIRS) {
      if (isKing) {
        let nr = r + dr, nc = c + dc;
        let foundEnemy = null;
        while (inBounds(nr, nc)) {
          const t = board[nr][nc];
          if (t) {
            if (foundEnemy) break;
            if (pieceColor(t) === color) break;
            foundEnemy = { r: nr, c: nc };
          } else if (foundEnemy) {
            moves.push({ r: nr, c: nc, captured: foundEnemy });
          }
          nr += dr; nc += dc;
        }
      } else {
        const er = r + dr, ec = c + dc;
        const lr = r + 2 * dr, lc = c + 2 * dc;
        if (!inBounds(lr, lc)) continue;
        const e = board[er][ec];
        if (!e || pieceColor(e) === color) continue;
        if (board[lr][lc]) continue;
        moves.push({ r: lr, c: lc, captured: { r: er, c: ec } });
      }
    }
    return moves;
  }

  function getQuietMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    const isKing = pieceType(piece) === 'K';
    const moves = [];
    const dirs = isKing ? DIRS : (color === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
    for (const [dr, dc] of dirs) {
      if (isKing) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc) && !board[nr][nc]) {
          moves.push({ r: nr, c: nc });
          nr += dr; nc += dc;
        }
      } else {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !board[nr][nc]) moves.push({ r: nr, c: nc });
      }
    }
    return moves;
  }

  function hasAnyCapture(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && pieceColor(board[r][c]) === color) {
        if (getCaptureMoves(board, r, c).length > 0) return true;
      }
    }
    return false;
  }

  function getLegalMoves(board, r, c, currentPlayer, mustContinueFrom) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = pieceColor(piece);
    if (color !== currentPlayer) return [];
    if (mustContinueFrom) {
      if (mustContinueFrom.r !== r || mustContinueFrom.c !== c) return [];
      return getCaptureMoves(board, r, c);
    }
    if (hasAnyCapture(board, color)) {
      return getCaptureMoves(board, r, c);
    }
    return getQuietMoves(board, r, c);
  }

  function applyMove(board, fromR, fromC, toR, toC) {
    const newBoard = board.map(row => row.slice());
    let piece = newBoard[fromR][fromC];
    newBoard[fromR][fromC] = null;
    let captured = false;
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let cr = fromR + dr, cc = fromC + dc;
    while (cr !== toR || cc !== toC) {
      if (newBoard[cr][cc]) {
        newBoard[cr][cc] = null;
        captured = true;
      }
      cr += dr; cc += dc;
    }
    let promoted = false;
    if (pieceType(piece) === 'M') {
      if (piece[0] === 'w' && toR === 0) { piece = 'wK'; promoted = true; }
      if (piece[0] === 'b' && toR === 7) { piece = 'bK'; promoted = true; }
    }
    newBoard[toR][toC] = piece;
    return { newBoard, captured, promoted };
  }

  function applyMoves(moves) {
    let board = initialBoard();
    for (const m of moves) {
      board = applyMove(board, m.from.r, m.from.c, m.to.r, m.to.c).newBoard;
    }
    return board;
  }

  function hasAnyLegalMove(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && pieceColor(board[r][c]) === color) {
        if (getLegalMoves(board, r, c, color, null).length > 0) return true;
      }
    }
    return false;
  }

  function countPieces(board, color) {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && pieceColor(board[r][c]) === color) n++;
    }
    return n;
  }

  function gameStatus(board, currentPlayer) {
    const myCount = countPieces(board, currentPlayer);
    if (myCount === 0) return { ended: true, winner: currentPlayer === 'w' ? 'b' : 'w', reason: 'no_pieces' };
    const opp = currentPlayer === 'w' ? 'b' : 'w';
    if (countPieces(board, opp) === 0) return { ended: true, winner: currentPlayer, reason: 'no_pieces' };
    if (!hasAnyLegalMove(board, currentPlayer)) {
      return { ended: true, winner: opp, reason: 'no_moves' };
    }
    return { ended: false, inCheck: false };
  }

  function findKing() { return null; }
  function isInCheck() { return false; }

  function moveNotation(piece, from, to, capture, promoted) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromSq = files[from.c] + (8 - from.r);
    const toSq = files[to.c] + (8 - to.r);
    const sep = capture ? 'x' : '-';
    let str = fromSq + sep + toSq;
    if (promoted) str += '👑';
    return str;
  }

  function canContinueCapture(board, r, c) {
    return getCaptureMoves(board, r, c).length > 0;
  }

  const api = {
    initialBoard, getLegalMoves, applyMove, applyMoves, hasAnyLegalMove,
    gameStatus, pieceColor, pieceType, findKing, isInCheck, moveNotation,
    canContinueCapture, hasAnyCapture, getCaptureMoves,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Checkers = api;
})(typeof window !== 'undefined' ? window : globalThis);
