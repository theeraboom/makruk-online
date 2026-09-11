/* Opt-in real-browser suite. QA_BASE defaults to the local staging server.
   Set PLAYWRIGHT_MODULE if Playwright is supplied by a shared runtime.
   All rooms are private, vs AI, and resigned in finally blocks. */
const{chromium,webkit,devices}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.QA_BASE||'http://127.0.0.1:3218',out=process.env.QA_OUTPUT||'work/immersive-qa';
const results=[];
async function frame(page){await page.waitForFunction(()=>document.querySelector('#appFrame')?.contentWindow?.location.href.includes('_view=content')&&document.querySelector('#appFrame').contentWindow.location.pathname===location.pathname);return page.frames().find(x=>x.url().includes('_view=content'))}
async function create(page,game){await page.goto(base);let f=await frame(page);await f.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected);await f.evaluate(game=>{lastCreatedPw=crypto.randomUUID();socket.emit('create_room',{name:'Immersive board QA',gameType:game,botEnabled:true,botDifficulty:'easy',userColor:game==='checkers-intl'?'b':'w',password:lastCreatedPw})},game);await page.waitForURL('**/room.html?id=*');f=await frame(page);await f.waitForFunction(()=>board&&(boardScene||sceneFailed));return f;}
async function clickSquare(page,f,r,c,piece=false,touch=false){const p=await f.evaluate(({r,c,piece})=>boardScene.projectSquare(r,c,piece),{r,c,piece});if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
async function main(){await fs.mkdir(out,{recursive:true});for(const[name,engine,options]of[['chrome',chromium,{viewport:{width:1360,height:1050}}],['webkit-mobile',webkit,{...devices['iPhone 13']}]]){
  const browser=await engine.launch(name==='chrome'?{channel:'chrome',headless:true}:{headless:true});
  try{for(const game of ['chess','chess-intl','checkers','checkers-intl','connect4']){
    const page=await browser.newPage(options),errors=[];page.on('pageerror',e=>errors.push(e.message));let f;
    try{
      f=await create(page,game);await f.waitForFunction(()=>boardScene&&use3D);assert.equal(await f.evaluate(()=>sceneFailed),false);
      assert.equal(await f.evaluate(()=>pieceSet),'studio');await page.waitForTimeout(400);
      const baseline=await f.evaluate(()=>({camera:boardScene.camera.position.toArray(),moves:moves.length,selected}));
      const canvas=await f.locator('canvas.board-canvas').boundingBox();
      // Drag rotates the camera without selecting or moving a piece.
      await page.mouse.move(canvas.x+canvas.width*.45,canvas.y+canvas.height*.5);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.7,canvas.y+canvas.height*.58,{steps:12});await page.mouse.up();await page.waitForTimeout(350);
      const after=await f.evaluate(()=>({camera:boardScene.camera.position.toArray(),moves:moves.length,selected}));assert.notDeepEqual(after.camera,baseline.camera);assert.equal(after.moves,baseline.moves);assert.equal(after.selected,null);
      // Free camera survives a same-position server render (chat/seat/reconnect).
      const angle=await f.evaluate(()=>boardScene.controls.getAzimuthalAngle());await f.evaluate(()=>render());assert.ok(Math.abs(await f.evaluate(()=>boardScene.controls.getAzimuthalAngle())-angle)<.01);
      await f.locator('#cameraMine').click();await page.waitForTimeout(200);
      const distance=await f.evaluate(()=>boardScene.controls.getDistance());await f.locator('#cameraZoomIn').click();assert.ok(await f.evaluate(()=>boardScene.controls.getDistance())<distance);await f.locator('#cameraMine').click();
      // Orbit to the opponent before making a legal move using canvas input.
      await f.locator('#cameraOpponent').click();await page.waitForTimeout(250);
      if(game==='connect4')await clickSquare(page,f,1,3,false,name!=='chrome');
      else {
        const opening=await f.evaluate(()=>{for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]?.[0]===myRole){const legal=legalMovesFor(r,c);if(legal.length)return{r,c,to:legal[0]};}});
        await clickSquare(page,f,opening.r,opening.c,true,name!=='chrome');await f.waitForFunction(()=>selected!==null);assert.deepEqual(await f.evaluate(()=>selected),{r:opening.r,c:opening.c});
        await clickSquare(page,f,opening.to.r,opening.to.c,false,name!=='chrome');
      }
      await f.waitForFunction(()=>moves.length>=2,{},{timeout:15000});
      assert.equal(await f.evaluate(()=>boardScene.pieces.size),await f.evaluate(()=>board.flat().filter(Boolean).length));
      // All eight materials and all applicable models must rebuild without errors.
      for(const theme of ['darkwood','marble','neon','green','blue','purple','gray','wood']){
        await f.locator('.board-theme-picker>summary').click();await f.locator('#themeOptions [data-theme="'+theme+'"]').click();assert.equal(await f.locator('.board-theme-picker').getAttribute('open'),null);
      }
      if(game!=='connect4')for(const set of ['classic','thai-carved','thai-letters','outline','studio']){
        await f.locator('#piecePicker>summary').click();await f.locator('#pieceOptions [data-pieceset="'+set+'"]').click();assert.equal(await f.locator('#piecePicker').getAttribute('open'),null);
      }
      await f.locator('#camera3D').click();await f.locator('#cameraFocus').click();assert.equal(await f.locator('.game-section.is-focused').count(),1);
      const player=await f.locator('.players-bar').boundingBox(),camera=await f.locator('#boardCamera').boundingBox(),stage=await f.locator('#boardStage').boundingBox();assert.ok(player.y+player.height<=stage.y+1);assert.ok(stage.y+stage.height<=camera.y+1);
      await page.waitForTimeout(350);await page.screenshot({path:path.join(out,game+'-'+name+'.png')});
      await f.locator('#cameraFocus').click();
      await f.locator('#cameraMode').click();assert.equal(await f.evaluate(()=>use3D),false);assert.ok(await f.locator('#boardWrapper').isVisible());await f.locator('#cameraMode').click();assert.equal(await f.evaluate(()=>use3D),true);
      // A still scene stops rendering; there is no permanent background loop.
      await page.waitForTimeout(500);const n=await f.evaluate(()=>boardScene.renderer.info.render.frame);await page.waitForTimeout(400);assert.equal(await f.evaluate(()=>boardScene.renderer.info.render.frame),n);
      assert.deepEqual(errors,[]);results.push({browser:name,game,default3D:true,dragDoesNotMove:true,opponentSideMoveAndAI:true,zoom:true,allThemesAndPieces:true,focusLayout:true,fallbackSwitch:true,idleRenderingStops:true,errors});console.log('PASS',name,game);
    }finally{if(f)await f.evaluate(()=>socket.emit('resign')).catch(()=>{});await page.close();}
  }
  if(name==='chrome') {
    const page=await browser.newPage({...devices['iPhone 13']});let f=await create(page,'chess');await f.locator('#cameraMine').click();
    const session=await page.context().newCDPSession(page);const bounds=await f.locator('canvas').boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
    const touch=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5,force:1}))});
    const opening=await f.evaluate(()=>({moves:moves.length,selected,camera:boardScene.camera.position.toArray()}));
    await touch('touchStart',[[1,x,y]]);for(let i=1;i<=8;i++)await touch('touchMove',[[1,x+i*8,y+i*2]]);await touch('touchEnd',[]);await page.waitForTimeout(400);
    assert.notDeepEqual(await f.evaluate(()=>boardScene.camera.position.toArray()),opening.camera);assert.equal(await f.evaluate(()=>moves.length),opening.moves);assert.equal(await f.evaluate(()=>selected),null);
    const before=await f.evaluate(()=>boardScene.controls.getDistance());
    await touch('touchStart',[[1,x-25,y],[2,x+25,y]]);for(let i=1;i<=6;i++)await touch('touchMove',[[1,x-25-i*4,y],[2,x+25+i*4,y]]);await touch('touchEnd',[]);await page.waitForTimeout(350);
    assert.ok(await f.evaluate(()=>boardScene.controls.getDistance())<before);assert.equal(await f.evaluate(()=>moves.length),opening.moves);assert.equal(await f.evaluate(()=>selected),null);
    await f.evaluate(()=>socket.emit('resign'));await page.close();results.push({browser:name,touchDrag:true,pinchZoom:true,multiTouchDoesNotMove:true});
  }
  // A device without WebGL can still enter a room and play with the DOM board.
  {const page=await browser.newPage(options);await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});const f=await create(page,'chess');assert.equal(await f.evaluate(()=>sceneFailed&&!use3D),true);await f.locator('#board .square[data-row="5"][data-col="0"]').click();await f.locator('#board .square[data-row="4"][data-col="0"]').click();await f.waitForFunction(()=>moves.length>=2);await f.evaluate(()=>socket.emit('resign'));await page.close();results.push({browser:name,noWebGLFallbackPlayable:true});}
  // Simulated WebGL context loss must restore the playable 2D board.
  const page=await browser.newPage(options);let f=await create(page,'chess');await f.evaluate(()=>boardScene.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());await f.waitForFunction(()=>sceneFailed&&!use3D&&!boardScene);await f.locator('#board .square[data-row="5"][data-col="0"]').click();await f.locator('#board .square[data-row="4"][data-col="0"]').click();await f.waitForFunction(()=>moves.length>=2);await f.evaluate(()=>socket.emit('resign'));await page.close();results.push({browser:name,contextLossFallbackPlayable:true});
  }finally{await browser.close();}
}
await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
main().catch(async e=>{console.error(e);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'partial-checks.json'),JSON.stringify(results,null,2));process.exitCode=1;});
