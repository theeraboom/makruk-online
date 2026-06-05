/* ────────────────────────────────────────────────────────
 *  Connect Four (4 in a Row) game engine
 *  Board: 6 rows × 7 columns
 *  Pieces: 'Y' (yellow, player 'w') and 'R' (red, player 'b')
 *  API follows the same pattern as chess.js / checkers.js
 * ──────────────────────────────────────────────────────── */
(function (global) {
  const ROWS = 6;
  const COLS = 7;
  const WIN_LENGTH = 4;

  function initialBoard() {
    return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  }

  function pieceColor(p) { return p === 'Y' ? 'w' : p === 'R' ? 'b' : null; }
  function pieceType(p) { return p; }

  /**
   * Drop a piece into column `col`. Returns the landing row or -1 if full.
   */
  function findLandingRow(board, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!board[r][col]) return r;
    }
    return -1;
  }

  /**
   * Get legal moves for the current player.
   * Each move: { col, r } where r is the landing row.
   */
  function getLegalMoves(board) {
    const moves = [];
    for (let c = 0; c < COLS; c++) {
      const r = findLandingRow(board, c);
      if (r >= 0) moves.push({ r, c, col: c });
    }
    return moves;
  }

  /**
   * Apply a move: drop the current player's piece into column `col`.
   * Returns new board.
   */
  function applyMove(board, col, color) {
    const newBoard = board.map(row => row.slice());
    const r = findLandingRow(newBoard, col);
    if (r < 0) return newBoard;
    newBoard[r][col] = color === 'w' ? 'Y' : 'R';
    return newBoard;
  }

  function applyMoves(moves) {
    let board = initialBoard();
    let color = 'w';
    for (const m of moves) {
      board = applyMove(board, m.col, color);
      color = color === 'w' ? 'b' : 'w';
    }
    return board;
  }

  /**
   * Check for 4 in a row. Returns winning cells or null.
   */
  function checkWin(board) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        for (const [dr, dc] of directions) {
          const cells = [];
          let ok = true;
          for (let i = 0; i < WIN_LENGTH; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== piece) {
              ok = false;
              break;
            }
            cells.push({ r: nr, c: nc });
          }
          if (ok) return { winner: pieceColor(piece), cells };
        }
      }
    }
    return null;
  }

  /**
   * Check if board is completely full (draw).
   */
  function isBoardFull(board) {
    for (let c = 0; c < COLS; c++) {
      if (!board[0][c]) return false;
    }
    return true;
  }

  function gameStatus(board) {
    const win = checkWin(board);
    if (win) return { ended: true, winner: win.winner, reason: 'connect4', winCells: win.cells };
    if (isBoardFull(board)) return { ended: true, winner: null, reason: 'draw' };
    return { ended: false, inCheck: false };
  }

  function hasAnyLegalMove(board) {
    return getLegalMoves(board).length > 0;
  }

  function findKing() { return null; }
  function isInCheck() { return false; }

  function moveNotation(piece, from, to, capture, promoted, moveInfo) {
    // Simple notation: column letter (a-g) + row number
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const col = moveInfo && moveInfo.col !== undefined ? moveInfo.col : (to ? to.c : 0);
    const row = to ? (ROWS - to.r) : 0;
    return files[col] + row;
  }

  const api = {
    initialBoard, getLegalMoves, applyMove, applyMoves,
    hasAnyLegalMove, gameStatus, pieceColor, pieceType,
    findKing, isInCheck, moveNotation, checkWin,
    findLandingRow, isBoardFull,
    ROWS, COLS,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Connect4 = api;
})(typeof window !== 'undefined' ? window : globalThis);
