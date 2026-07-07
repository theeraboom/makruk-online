const Chess = require('./public/chess.js');
const ChessIntl = require('./public/chess-intl.js');
const Checkers = require('./public/checkers.js');
const CheckersIntl = require('./public/checkers-intl.js');
const Connect4 = require('./public/connect4.js');

const ENGINES = {
  'chess': Chess,
  'chess-intl': ChessIntl,
  'checkers': Checkers,
  'checkers-intl': CheckersIntl,
};

const PIECE_VALUES = {
  'chess': { K: 1000, Q: 2, B: 2.5, N: 3, R: 5, P: 1 },
  'chess-intl': { K: 1000, Q: 9, B: 3.2, N: 3, R: 5, P: 1 },
  'checkers': { M: 1, K: 4 },
  'checkers-intl': { M: 1, K: 2.5 },
};

const DIFFICULTY_DEPTH = { easy: 1, medium: 3, hard: 4 };
const CHECKERS_TYPES = ['checkers', 'checkers-intl'];

function oppositeColor(c) { return c === 'w' ? 'b' : 'w'; }

function evaluate(board, gameType, color) {
  const values = PIECE_VALUES[gameType];
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const v = values[piece[1]] || 0;
      if (piece[0] === color) score += v;
      else score -= v;
    }
  }
  // Tiny center bonus for chess (encourage development)
  if (!CHECKERS_TYPES.includes(gameType)) {
    for (const [r, c] of [[3,3],[3,4],[4,3],[4,4]]) {
      const p = board[r][c];
      if (p) {
        if (p[0] === color) score += 0.1;
        else score -= 0.1;
      }
    }
  }
  return score;
}

function getAllLegalMoves(engine, board, color, gameType, ctx, mustContinueFrom) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || engine.pieceColor(piece) !== color) continue;
      let legal;
      if (CHECKERS_TYPES.includes(gameType)) {
        legal = engine.getLegalMoves(board, r, c, color, mustContinueFrom);
      } else if (gameType === 'chess-intl') {
        legal = engine.getLegalMoves(board, r, c, ctx);
      } else {
        legal = engine.getLegalMoves(board, r, c);
      }
      for (const m of legal) {
        moves.push({ from: { r, c }, to: { r: m.r, c: m.c }, info: m });
      }
    }
  }
  return moves;
}

function applyForAI(engine, board, move, gameType) {
  if (CHECKERS_TYPES.includes(gameType)) {
    return engine.applyMove(board, move.from.r, move.from.c, move.to.r, move.to.c).newBoard;
  }
  if (gameType === 'chess-intl') {
    return engine.applyMove(board, move.from.r, move.from.c, move.to.r, move.to.c, move.info);
  }
  return engine.applyMove(board, move.from.r, move.from.c, move.to.r, move.to.c);
}

function updateCtx(ctx, move, oldBoard, gameType) {
  if (gameType !== 'chess-intl') return ctx;
  const newCtx = {
    castling: { ...ctx.castling },
    enPassant: null,
  };
  const piece = oldBoard[move.from.r][move.from.c];
  if (piece === 'wK') { newCtx.castling.wK = false; newCtx.castling.wQ = false; }
  if (piece === 'bK') { newCtx.castling.bK = false; newCtx.castling.bQ = false; }
  if (piece === 'wR' && move.from.r === 7 && move.from.c === 0) newCtx.castling.wQ = false;
  if (piece === 'wR' && move.from.r === 7 && move.from.c === 7) newCtx.castling.wK = false;
  if (piece === 'bR' && move.from.r === 0 && move.from.c === 0) newCtx.castling.bQ = false;
  if (piece === 'bR' && move.from.r === 0 && move.from.c === 7) newCtx.castling.bK = false;
  if (move.to.r === 7 && move.to.c === 0) newCtx.castling.wQ = false;
  if (move.to.r === 7 && move.to.c === 7) newCtx.castling.wK = false;
  if (move.to.r === 0 && move.to.c === 0) newCtx.castling.bQ = false;
  if (move.to.r === 0 && move.to.c === 7) newCtx.castling.bK = false;
  if (move.info && move.info.doublePawn) {
    const dir = piece === 'wP' ? -1 : 1;
    newCtx.enPassant = { r: move.from.r + dir, c: move.from.c };
  }
  return newCtx;
}

function getStatus(engine, board, currentColor, gameType, ctx) {
  if (gameType === 'chess-intl') return engine.gameStatus(board, currentColor, ctx);
  return engine.gameStatus(board, currentColor);
}

function isCaptureMove(m) {
  return !!(m.info && (m.info.capture || m.info.captured));
}

// Captures first — dramatically better alpha-beta pruning
function orderMoves(moves) {
  moves.sort((a, b) => (isCaptureMove(b) ? 1 : 0) - (isCaptureMove(a) ? 1 : 0));
  return moves;
}

// Checkers: after a capture that can continue (กินติด), the SAME player moves
// again, constrained to the landing piece. Recurse without flipping the turn
// and without consuming depth (chains are forced and finite).
function chainsOn(engine, gameType, m, newBoard) {
  return CHECKERS_TYPES.includes(gameType)
    && m.info && m.info.captured
    && engine.canContinueCapture(newBoard, m.to.r, m.to.c);
}

function minimax(engine, board, depth, alpha, beta, isMax, botColor, currentColor, gameType, ctx, mustContinueFrom) {
  if (depth === 0) return evaluate(board, gameType, botColor);

  const status = getStatus(engine, board, currentColor, gameType, ctx);
  if (status.ended) {
    if (status.winner === botColor) return 10000 + depth;
    if (status.winner === null) return 0;
    return -10000 - depth;
  }

  const moves = getAllLegalMoves(engine, board, currentColor, gameType, ctx, mustContinueFrom || null);
  if (moves.length === 0) return evaluate(board, gameType, botColor);
  orderMoves(moves);

  if (isMax) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const nb = applyForAI(engine, board, m, gameType);
      const nctx = updateCtx(ctx, m, board, gameType);
      const e = chainsOn(engine, gameType, m, nb)
        ? minimax(engine, nb, depth, alpha, beta, true, botColor, currentColor, gameType, nctx, { r: m.to.r, c: m.to.c })
        : minimax(engine, nb, depth - 1, alpha, beta, false, botColor, oppositeColor(currentColor), gameType, nctx, null);
      if (e > maxEval) maxEval = e;
      if (e > alpha) alpha = e;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const nb = applyForAI(engine, board, m, gameType);
      const nctx = updateCtx(ctx, m, board, gameType);
      const e = chainsOn(engine, gameType, m, nb)
        ? minimax(engine, nb, depth, alpha, beta, false, botColor, currentColor, gameType, nctx, { r: m.to.r, c: m.to.c })
        : minimax(engine, nb, depth - 1, alpha, beta, true, botColor, oppositeColor(currentColor), gameType, nctx, null);
      if (e < minEval) minEval = e;
      if (e < beta) beta = e;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// ============ Connect Four bot ============
// Column-drop game — separate logic from the 8x8 board games above.
function c4LegalCols(board) {
  const cols = [];
  for (let c = 0; c < Connect4.COLS; c++) {
    if (Connect4.findLandingRow(board, c) >= 0) cols.push(c);
  }
  return cols;
}

// Heuristic eval from `color`'s perspective: score every length-4 window.
function c4Evaluate(board, color) {
  const ROWS = Connect4.ROWS, COLS = Connect4.COLS;
  const me = color === 'w' ? 'Y' : 'R';
  const opp = color === 'w' ? 'R' : 'Y';
  const scoreWindow = (cells) => {
    let mine = 0, theirs = 0, empty = 0;
    for (const p of cells) {
      if (p === me) mine++;
      else if (p === opp) theirs++;
      else empty++;
    }
    if (mine > 0 && theirs > 0) return 0;
    if (mine === 3 && empty === 1) return 8;
    if (mine === 2 && empty === 2) return 3;
    if (mine === 1 && empty === 3) return 1;
    if (theirs === 3 && empty === 1) return -10;
    if (theirs === 2 && empty === 2) return -3;
    return 0;
  };
  let score = 0;
  // center column control
  const centerCol = Math.floor(COLS / 2);
  for (let r = 0; r < ROWS; r++) {
    if (board[r][centerCol] === me) score += 3;
    else if (board[r][centerCol] === opp) score -= 3;
  }
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        const cells = [];
        for (let i = 0; i < 4; i++) cells.push(board[r + dr * i][c + dc * i]);
        score += scoreWindow(cells);
      }
    }
  }
  return score;
}

// Negamax with alpha-beta. `board` is the position with `color` to move.
function c4Negamax(board, depth, alpha, beta, color) {
  // A win on the board means the side that just moved (not `color`) won → loss for `color`.
  if (Connect4.checkWin(board)) return -100000 - depth;
  const cols = c4LegalCols(board);
  if (cols.length === 0) return 0; // draw
  if (depth === 0) return c4Evaluate(board, color);
  const opp = color === 'w' ? 'b' : 'w';
  // center-first ordering improves pruning
  const order = cols.slice().sort((a, b) => Math.abs((Connect4.COLS - 1) / 2 - a) - Math.abs((Connect4.COLS - 1) / 2 - b));
  let best = -Infinity;
  for (const c of order) {
    const nb = Connect4.applyMove(board, c, color);
    const score = -c4Negamax(nb, depth - 1, -beta, -alpha, opp);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseConnect4Move(board, botColor, difficulty) {
  const legal = c4LegalCols(board);
  if (legal.length === 0) return null;
  const opp = botColor === 'w' ? 'b' : 'w';
  const toMove = (col) => ({ from: null, to: { r: Connect4.findLandingRow(board, col), c: col }, info: { col } });

  // 1. Take an immediate win.
  for (const c of legal) {
    const w = Connect4.checkWin(Connect4.applyMove(board, c, botColor));
    if (w && w.winner === botColor) return toMove(c);
  }
  // 2. Block the opponent's immediate win.
  for (const c of legal) {
    const w = Connect4.checkWin(Connect4.applyMove(board, c, opp));
    if (w && w.winner === opp) return toMove(c);
  }
  if (difficulty === 'easy') {
    // Easy: prefer center-ish but mostly random.
    if (Math.random() < 0.4) return toMove(legal[Math.floor(Math.random() * legal.length)]);
  }

  const depth = difficulty === 'hard' ? 6 : difficulty === 'medium' ? 4 : 2;
  const order = legal.slice().sort((a, b) => Math.abs((Connect4.COLS - 1) / 2 - a) - Math.abs((Connect4.COLS - 1) / 2 - b));
  let best = order[0], bestScore = -Infinity;
  for (const c of order) {
    const nb = Connect4.applyMove(board, c, botColor);
    const score = -c4Negamax(nb, depth - 1, -Infinity, Infinity, opp);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return toMove(best);
}

function chooseMove(board, gameType, botColor, ctx, mustContinueFrom, difficulty) {
  if (gameType === 'connect4') return chooseConnect4Move(board, botColor, difficulty);

  const engine = ENGINES[gameType];
  if (!engine) return null;

  let depth = DIFFICULTY_DEPTH[difficulty] || 2;
  if (gameType === 'chess-intl' && depth >= 4) depth = 3;

  const moves = getAllLegalMoves(engine, board, botColor, gameType, ctx, mustContinueFrom);
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    const captures = moves.filter(m => m.info && (m.info.capture || m.info.captured));
    const pool = captures.length > 0 ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  shuffleArray(moves);
  orderMoves(moves);
  let bestMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const m of moves) {
    const nb = applyForAI(engine, board, m, gameType);
    const nctx = updateCtx(ctx, m, board, gameType);
    const score = chainsOn(engine, gameType, m, nb)
      ? minimax(engine, nb, depth, alpha, Infinity, true, botColor, botColor, gameType, nctx, { r: m.to.r, c: m.to.c })
      : minimax(engine, nb, depth - 1, alpha, Infinity, false, botColor, oppositeColor(botColor), gameType, nctx, null);
    if (score > bestScore) { bestScore = score; bestMove = m; }
    if (score > alpha) alpha = score;
  }
  return bestMove;
}

module.exports = { chooseMove, DIFFICULTY_DEPTH };
