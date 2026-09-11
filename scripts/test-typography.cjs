/* Real browser layout checks. Result strings below are client-side render
   fixtures; they do not change a live game's outcome. Rooms are private. */
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.QA_BASE || 'http://127.0.0.1:3218';
const out = process.env.QA_OUTPUT || 'work/typography-qa';

async function content(page) {
  await page.waitForFunction(() => document.querySelector('#appFrame')?.contentWindow?.location.pathname === location.pathname);
  const frame = page.frames().find(f => f.url().includes('_view=content'));
  await frame.waitForFunction(() => typeof I18N !== 'undefined');
  await frame.evaluate(() => document.fonts.ready);
  return frame;
}

async function textFits(frame, selectors) {
  const issues = await frame.evaluate(selectors => {
    const issues = [];
    for (const el of document.querySelectorAll(selectors)) {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (el.scrollWidth > el.clientWidth + 2) issues.push({ text: el.textContent, selector: el.id || el.className, reason: 'horizontal clipping' });
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim() || !node.parentElement.getClientRects().length) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const line of range.getClientRects()) {
          if (!line.width) continue;
          if (line.left < rect.left - 2 || line.right > rect.right + 2 || line.top < rect.top - 3 || line.bottom > rect.bottom + 3) {
            issues.push({ text: node.textContent, selector: el.id || el.className, reason: 'text outside container', rect: rect.toJSON(), line: line.toJSON() });
          }
        }
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push({ reason: 'page overflow' });
    return issues;
  }, selectors);
  assert.deepEqual(issues, []);
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  const results = [];
  for (const [name, engine] of [['Chrome', chromium], ['WebKit', webkit]]) {
    const browser = await engine.launch(name === 'Chrome' ? { channel: 'chrome', headless: true } : { headless: true });
    let room;
    try {
      const page = await browser.newPage({ ...devices['iPhone 13'] });
      const errors = [], failedFonts = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('requestfailed', req => { if (req.url().includes('/fonts/')) failedFonts.push(req.url()); });
      await page.addInitScript(() => { localStorage.setItem('makruk_dark', '0'); localStorage.setItem('makruk_name', 'Gogo'); });
      await page.goto(base);
      let frame = await content(page);
      await frame.waitForFunction(() => typeof savedName !== 'undefined');
      for (const width of [320, 375, 390, 430, 768, 1360]) {
        await page.setViewportSize({ width, height: width > 600 ? 1000 : 720 });
        for (const lang of ['th', 'en']) {
          await frame.evaluate(lang => I18N.setLang(lang), lang);
          await frame.evaluate(() => document.fonts.ready);
          await textFits(frame, '#profileButton,#langToggleBtn,.game-copy,.game-description,.section-header,.opponent-choice,#createBtn');
        }
      }
      await page.setViewportSize({ width:390, height:780 });
      await frame.evaluate(() => I18N.setLang('th'));
      await page.screenshot({ path: path.join(out, `lobby-th-${name}.png`) });
      await frame.locator('#profileButton').click();
      await textFits(frame, '#profileTitle,#saveName,#profileHint');
      await frame.locator('#closeProfile').click();
      await frame.waitForFunction(() => socket.connected);
      await frame.evaluate(() => {
        lastCreatedPw = crypto.randomUUID();
        socket.emit('create_room', { name:'', gameType:'connect4', botEnabled:true, botDifficulty:'medium', userColor:'w', password:lastCreatedPw });
      });
      await page.waitForURL('**/room.html?id=*');
      room = frame = await content(page);
      await frame.waitForFunction(() => typeof use3D !== 'undefined' && boardScene && Array.isArray(board));
      const ui = '.back-btn,#roomName,#roomGameTypeLabel,#roleBadge,.players-bar .player-name,#status,.camera-presets button';
      let count = 0;
      for (const width of [320, 375, 390, 430, 768, 1360]) {
        await page.setViewportSize({ width, height: width > 600 ? 1000 : 780 });
        for (const lang of ['th', 'en']) {
          for (const game of ['chess','chess-intl','checkers','checkers-intl','connect4']) {
            await frame.evaluate(({lang,game}) => {
              gameType=game; board=getEngine().initialBoard(); status='ended'; endedWinner='b'; endedReason=game==='connect4'?'connect4':'no_moves';
              I18N.setLang(lang);
              document.querySelector('#roomName').textContent=I18N.t('default.'+game);
              document.querySelector('#roomGameTypeLabel').textContent=I18N.t('game.'+game);
              updatePlayerSlot('W',{name:lang==='th'?'ผู้เล่นทดสอบชื่อยาวมากที่สุด':'AlexandertheGreatPlayer24'});
              updatePlayerSlot('B',{isBot:true,botDifficulty:'medium'});
              updateRoleBadge(); updateStatus();
            }, {lang,game});
            await frame.evaluate(() => document.fonts.ready);
            await textFits(frame, ui); count++;
          }
          for (const reason of ['resign','timeout','stalemate','repetition','fifty_move','draw']) {
            await frame.evaluate(reason => { endedReason=reason; endedWinner=['stalemate','repetition','fifty_move','draw'].includes(reason)?null:'b'; updateStatus(); }, reason);
            await textFits(frame, '#status'); count++;
          }
        }
      }
      await page.setViewportSize({ width:390, height:780 });
      for (const lang of ['en','th']) {
        await frame.evaluate(lang => {
          gameType='connect4'; board=Connect4.applyMoves([0,1,0,1,2,1,2,1].map(col=>({col}))); winCells=Connect4.checkWin(board).cells;
          status='ended'; endedReason='connect4'; endedWinner='b'; I18N.setLang(lang);
          document.querySelector('#roomName').textContent=I18N.t('default.connect4');
          document.querySelector('#roomGameTypeLabel').textContent=I18N.t('game.connect4');
          updatePlayerSlot('W',{name:'Gogo'}); updatePlayerSlot('B',{isBot:true,botDifficulty:'medium'}); updateStatus(); updateRoleBadge(); scrollTo(0,0);
          document.querySelectorAll('.player-info').forEach(el=>el.classList.remove('active'));
        }, lang);
        await frame.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(180);
        await frame.evaluate(() => scrollTo(0,0));
        await page.screenshot({ path:path.join(out,`connect4-${lang}-${name}.png`) });
      }
      assert.ok(await frame.evaluate(() => document.fonts.check('500 16px Manrope','Red wins') && document.fonts.check('500 16px "Noto Sans Thai"','ผู้เล่น')));
      await page.setViewportSize({ width:320, height:720 });
      await frame.locator('.board-theme-picker summary').click();
      await textFits(frame, '#themeOptions button');
      await frame.locator('.board-theme-picker summary').click();
      await frame.evaluate(() => { gameType='chess'; document.querySelector('#piecePicker').hidden=false; });
      await frame.locator('#piecePicker summary').click();
      await textFits(frame, '#pieceOptions button');
      await frame.locator('#piecePicker summary').click();
      await frame.evaluate(() => socket.emit('resign'));
      room = null;
      await page.evaluate(() => PlaymakrukShell.navigate('/rules.html'));
      await page.waitForURL('**/rules.html'); frame=await content(page);
      for (const lang of ['th','en']) { await frame.evaluate(lang=>I18N.setLang(lang),lang); await textFits(frame,'.guide-nav,.guide-content,.guide-notes'); }
      assert.deepEqual(errors,[]); assert.deepEqual(failedFonts,[]);
      results.push({ browser:name, bilingualResultFixtures:count, sixWidths:true, longNamesVisible:true, localFontsLoaded:true, cameraAndPickersFit:true, lobbyAndRulesFit:true, errors });
      console.log('PASS', name);
    } finally {
      if (room) await room.evaluate(() => socket.emit('resign')).catch(()=>{});
      await browser.close();
    }
  }
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
