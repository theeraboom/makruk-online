/* Rule state shared by the server and the browser. Sources: docs/rules-audit.md. */
(function(root){
 const node=typeof module!=='undefined'&&module.exports;
 const chess=node?require('./chess-intl'):root.ChessIntl;
 const engines=node?{chess:require('./chess'),'chess-intl':chess,checkers:require('./checkers'),'checkers-intl':require('./checkers-intl')}:null;
 const other=c=>c==='w'?'b':'w';
 function pieces(board,side){return board.flatMap((row,r)=>row.flatMap((p,c)=>p&&(!side||p[0]===side)?[{type:p[1],color:p[0],square:(r+c)%2}]:[]));}
 function positionKey(room){
  let rights='',ep='';
  if(room.gameType==='chess-intl'){
   rights=['wK','wQ','bK','bQ'].map(k=>room.castling?.[k]?'1':'0').join('');
   if(room.enPassant){for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(room.board[r][c]===room.currentPlayer+'P'&&chess.getLegalMoves(room.board,r,c,room).some(m=>m.enPassant))ep=room.enPassant.r+','+room.enPassant.c;}
  }
  return room.board.map(row=>row.map(p=>p||'..').join('')).join('/')+'|'+room.currentPlayer+'|'+rights+'|'+ep;
 }
 function emptyState(room){return{positions:{[positionKey(room)]:1},quietPlies:0,count:null,offer:null};}
 function ensure(room){
  if(room.drawState)return room.drawState;
  if(!room.moves?.length||!engines?.[room.gameType])return room.drawState=emptyState(room);
  // Older persisted rooms retain their history. Reconstruct counters without changing the live board.
  const engine=engines[room.gameType],replay={gameType:room.gameType,board:engine.initialBoard(),currentPlayer:room.moves[0].piece?.[0]||'w',castling:{wK:true,wQ:true,bK:true,bQ:true},enPassant:null};
  replay.drawState=emptyState(replay);
  try{for(let i=0;i<room.moves.length;i++){
   const m=room.moves[i],p=replay.board[m.from.r][m.from.c];
   if(room.gameType.startsWith('checkers')){const result=engine.applyMove(replay.board,m.from.r,m.from.c,m.to.r,m.to.c);replay.board=result.newBoard;}
   else{replay.board=engine.applyMove(replay.board,m.from.r,m.from.c,m.to.r,m.to.c,m.special);if(room.gameType==='chess-intl')Object.assign(replay,chess.nextContext(replay,p,m.from,m.to,m.special));}
   const next=room.moves[i+1]?.piece?.[0]||(i===room.moves.length-1?room.currentPlayer:other(p[0]));
   const completed=next!==p[0];replay.currentPlayer=next;
   record(replay,p,m.capture,completed);
  }room.drawState=replay.drawState;}catch{room.drawState=emptyState(room);}
  return room.drawState;
 }
 function materialScore(board,side){return pieces(board,side).reduce((sum,p)=>sum+({R:3,N:2,B:1.5,Q:1,P:.5}[p.type]||0),0);}
 function countEligibility(room,side){
  if(room.gameType!=='chess'||pieces(room.board).some(p=>p.type==='P'))return null;
  const mine=pieces(room.board,side),enemy=pieces(room.board,other(side));
  if(mine.length===1&&enemy.length>1){const n=t=>enemy.filter(p=>p.type===t).length;return{type:'pieces',limit:n('R')>=2?8:n('R')?16:n('B')>=2?22:n('B')?44:n('N')>=2?32:64,start:mine.length+enemy.length};}
  if(materialScore(room.board,side)<materialScore(room.board,other(side)))return{type:'board',limit:64,start:0};
  return null;
 }
 function startCount(room,side){const option=countEligibility(room,side);if(!option||room.currentPlayer!==side)return false;const d=ensure(room);if(d.count?.side===side&&d.count.type===option.type)return false;d.count={side,type:option.type,limit:option.limit,value:option.start};return true;}
 function stopCount(room,side){const d=ensure(room);if(d.count?.side!==side)return false;d.count=null;return true;}
 function record(room,piece,captured,completed){
  const d=room.drawState||emptyState(room);room.drawState=d;
  if(captured||piece[1]==='P'||piece[1]==='M')d.quietPlies=0;else if(completed)d.quietPlies++;
  if(d.offer&&piece[0]!==d.offer)d.offer=null;
  if(!completed)return;
  const key=positionKey(room);d.positions[key]=(d.positions[key]||0)+1;
  // Captures and pawn/man moves are irreversible; older positions cannot recur.
  if(captured||piece[1]==='P'||piece[1]==='M')d.positions={[key]:1};
  if(d.count){const count=d.count;
   if(count.type==='board'&&materialScore(room.board,count.side)>materialScore(room.board,other(count.side))){d.count=null;return;}
   if(piece[0]===count.side)count.value++;
  }
 }
 function deadPosition(room){
  const all=pieces(room.board),nonKings=all.filter(p=>p.type!=='K');
  if(room.gameType==='chess-intl'){
   if(!nonKings.length)return true;
   if(nonKings.length===1&&['B','N'].includes(nonKings[0].type))return true;
   return nonKings.every(p=>p.type==='B')&&new Set(nonKings.map(p=>p.square)).size===1;
  }
  if(room.gameType==='chess')return !nonKings.length||(nonKings.length===1&&['Q','N'].includes(nonKings[0].type));
  return false;
 }
 function timeoutWinner(room,loser){
  const winner=other(loser);
  if(room.gameType==='chess-intl'){
   if(deadPosition(room)||pieces(room.board,winner).every(p=>p.type==='K'))return null;
  }
  if(room.gameType==='chess'){
   const army=pieces(room.board,winner),n=t=>army.filter(p=>p.type===t).length;
   // Thai competition minimum force for a win on time (government handbook, rule 16).
   if(!(n('R')||n('B')>=2||n('N')>=2||(n('B')&&n('Q'))||(n('N')&&n('Q'))||n('Q')+n('P')>=3))return null;
  }
  return winner;
 }
 function claimReason(room){const d=ensure(room),repeats=d.positions[positionKey(room)]||0;
  if(room.mustContinueFrom)return null;
  if(repeats>=3)return 'threefold';
  if(room.gameType==='chess-intl'&&d.quietPlies>=100)return 'fifty';
  if(room.gameType==='checkers-intl'&&d.quietPlies>=80)return 'forty';
  return null;
 }
 function automaticReason(room){
  const d=ensure(room);if(room.mustContinueFrom)return null;
  if(deadPosition(room))return 'dead';
  if(room.gameType==='chess-intl'){
   if((d.positions[positionKey(room)]||0)>=5)return 'fivefold';
   if(d.quietPlies>=150)return 'seventyfive';
  }
  if(room.gameType==='chess'&&(d.positions[positionKey(room)]||0)>=3)return 'threefold';
  if(d.count&&room.currentPlayer===d.count.side&&d.count.value>=d.count.limit)return 'counting';
  return null;
 }
 function previewClaim(room,from,to,info){
  const engine=engines?.[room.gameType];if(!engine||room.mustContinueFrom)return null;
  const copy={...room,drawState:JSON.parse(JSON.stringify(ensure(room)))},p=room.board[from.r][from.c];
  let captured=!!room.board[to.r][to.c]||!!info.enPassant,completed=true;
  if(room.gameType.startsWith('checkers')){const result=engine.applyMove(room.board,from.r,from.c,to.r,to.c);copy.board=result.newBoard;captured=result.captured;completed=!captured||!engine.canContinueCapture(copy.board,to.r,to.c,result.promoted);}
  else{copy.board=engine.applyMove(room.board,from.r,from.c,to.r,to.c,info);if(room.gameType==='chess-intl')Object.assign(copy,chess.nextContext(room,p,from,to,info));}
  if(!completed)return null;
  copy.currentPlayer=other(room.currentPlayer);copy.mustContinueFrom=null;record(copy,p,captured,true);return claimReason(copy);
 }
 function summary(room){const d=ensure(room);return{claim:claimReason(room),count:d.count,offer:d.offer,canCount:{w:countEligibility(room,'w'),b:countEligibility(room,'b')}};}
 const api={positionKey,ensure,record,previewClaim,claimReason,automaticReason,deadPosition,timeoutWinner,countEligibility,startCount,stopCount,summary};
 if(node)module.exports=api;else root.MatchRules=api;
})(typeof window!=='undefined'?window:globalThis);
