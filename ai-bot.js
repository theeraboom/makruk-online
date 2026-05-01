const Chess = require('./public/chess.js');
const ChessIntl = require('./public/chess-intl.js');
const Checkers = require('./public/checkers.js');
const CheckersIntl = require('./public/checkers-intl.js');

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

function minimax(engine, board, depth, alpha, beta, isMax, botColor, currentColor, gameType, ctx) {
  if (depth === 0) return evaluate(board, gameType, botColor);

  const status = getStatus(engine, board, currentColor, gameType, ctx);
  if (status.ended) {
    if (status.winner === botColor) return 10000 + depth;
    if (status.winner === null) return 0;
    return -10000 - depth;
  }

  const moves = getAllLegalMoves(engine, board, currentColor, gameType, ctx, null);
  if (moves.length === 0) return evaluate(board, gameType, botColor);

  if (isMax) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const nb = applyForAI(engine, board, m, gameType);
      const nctx = updateCtx(ctx, m, board, gameType);
      const e = minimax(engine, nb, depth - 1, alpha, beta, false, botColor, oppositeColor(currentColor), gameType, nctx);
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
      const e = minimax(engine, nb, depth - 1, alpha, beta, true, botColor, oppositeColor(currentColor), gameType, nctx);
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

function chooseMove(board, gameType, botColor, ctx, mustContinueFrom, difficulty) {
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
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const nb = applyForAI(engine, board, m, gameType);
    const nctx = updateCtx(ctx, m, board, gameType);
    const score = minimax(engine, nb, depth - 1, -Infinity, Infinity, false, botColor, oppositeColor(botColor), gameType, nctx);
    if (score > bestScore) { bestScore = score; bestMove = m; }
  }
  return bestMove;
}

module.exports = { chooseMove, DIFFICULTY_DEPTH };
