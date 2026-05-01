(function (global) {
  const TRANSLATIONS = {
    th: {
      // Header / common
      'logo.tagline': 'หมากรุก / หมากฮอส ออนไลน์',
      'logo.tagline.rules': 'ประวัติและกติกา',
      'lang.toggle': 'EN',
      'name.label': 'ชื่อ:',
      'name.placeholder': 'ตั้งชื่อของคุณ',
      'name.save': 'บันทึก',
      'name.saved': '✓ บันทึก',
      'back': '← กลับ',

      // Hero (lobby)
      'hero.title': 'เล่นหมากรุก หมากฮอส ออนไลน์',
      'hero.sub': 'นั่งเล่น ยืนดู คุยกันสนุกๆ บรรยากาศเป็นกันเอง — สองคนเล่น คนอื่นๆ ยืนดูล้อมวง พูดคุยเชียร์กันได้ทุกเมื่อ',
      'stat.rooms': 'ห้องเปิด',
      'stat.players': 'กำลังเล่น',
      'stat.viewers': 'กำลังดู',
      'stat.visits': 'ผู้เข้าชมทั้งหมด',

      // Create room
      'create.gameType': '🎲 ประเภทเกม',
      'gt.chess': '♛ หมากรุกไทย',
      'gt.chess-intl': '♚ หมากรุกสากล',
      'gt.checkers': '⛂ หมากฮอสไทย',
      'gt.checkers-intl': '⛀ หมากฮอสสากล',
      'create.roomName': 'ตั้งชื่อห้อง',
      'create.timeBase': '⏱ เวลารวมต่อฝ่าย',
      'create.timeIncrement': '➕ เพิ่มต่อตา',
      'tc.none': 'ไม่จับ',
      'tc.noinc': 'ไม่เพิ่ม',
      'tc.min': 'น.',
      'tc.hour': 'ชม.',
      'tc.sec': 'วิ',
      'create.password': '🔒 รหัสห้อง',
      'create.password.hint': '(ใส่ถ้าอยากให้เป็นห้องส่วนตัว)',
      'create.password.placeholder': 'ปล่อยว่าง = ห้องสาธารณะ',
      'create.bot': '🤖 เล่นกับ Bot (ฝึกซ้อมคนเดียว)',
      'bot.easy': '😊 ง่าย',
      'bot.medium': '🤔 กลาง',
      'bot.hard': '🔥 ยาก',
      'create.botColor': 'คุณเป็นฝ่าย:',
      'side.white': '⚪ ขาว (เดินก่อน)',
      'side.black': '⚫ ดำ',
      'create.button': '+ เปิดวงเล่นใหม่',

      // Rooms list
      'rooms.heading': 'วงที่กำลังเล่นอยู่',
      'rooms.empty': 'ยังไม่มีวงเปิด — เปิดวงใหม่ได้เลย',
      'room.live': '🔴 LIVE',
      'room.waiting': '⏳ รอผู้เล่น',
      'room.ended': '✓ จบเกม',
      'room.private': '🔒 ส่วนตัว',
      'room.viewers': 'คนดู',
      'room.players': 'ผู้เล่น',
      'room.turnW': 'ตาขาว',
      'room.turnB': 'ตาดำ',
      'room.join': 'เข้าร่วม →',

      // Sidebar info cards
      'how.title': '📜 วิธีเข้าร่วม',
      'how.1': 'กดเปิดวงใหม่ หรือเข้าวงที่เปิดอยู่',
      'how.2': '2 คนแรก = ผู้เล่น (ขาว/ดำ)',
      'how.3': 'คนถัดไป = ยืนดู + ร่วมพูดคุยในแชท',
      'rulesShort.title': '♟ กฎทั้ง 4 เกม ฉบับย่อ',
      'rulesShort.read': 'อ่านประวัติและกติกาเต็ม →',

      // Room — players bar
      'player.waiting': 'รอผู้เล่น',
      'role.w': '⚪ คุณคือฝ่ายขาว',
      'role.b': '⚫ คุณคือฝ่ายดำ',
      'role.viewer': '👁 คุณกำลังดู',
      'role.connecting': 'กำลังเชื่อมต่อ...',
      'status.waiting': '⏳ รอผู้เล่นอีก 1 คน',
      'status.ended': '🏁 เกมจบแล้ว',
      'status.turnW': 'ตาฝ่ายขาว',
      'status.turnB': 'ตาฝ่ายดำ',
      'status.check': 'ถูกรุก!',
      'status.continue': 'กินต่อได้!',

      // Room — controls
      'btn.resign': '🏳 ยอมแพ้',
      'btn.reset': '🔁 เริ่มเกมใหม่',
      'btn.flip': '↕ หมุนกระดาน',
      'btn.share': '🔗 แชร์',
      'btn.theme': '🎨 ธีม',
      'btn.pieces': '♟ ตัวหมาก',
      'theme.wood': 'ไม้',
      'theme.green': 'เขียว',
      'theme.blue': 'น้ำเงิน',
      'theme.purple': 'ม่วง',
      'theme.gray': 'เทา',
      'pieces.classic': 'คลาสสิก',
      'pieces.thai-carved': 'ไทยแกะสลัก',
      'pieces.thai-letters': 'อักษรไทย',
      'pieces.outline': 'โครงเส้น',
      'viewers.count': 'คนกำลังดู',

      // Room — chat / panels
      'chat.live': 'แชทสด',
      'chat.placeholder': 'พิมพ์ข้อความ...',
      'chat.send': 'ส่ง',
      'chat.messages': 'ข้อความ',
      'viewers.title': 'ผู้ชม',
      'viewers.empty': 'ยังไม่มีคนยืนดู',
      'history.title': '📜 ประวัติการเดิน',
      'history.empty': 'ยังไม่มีการเดิน',
      'rules.summary': '📖 กฎการเดินหมาก',
      'rules.readFull': 'อ่านประวัติและกติกาเต็ม →',

      // Footer
      'footer.rules': 'กฎหมากรุก / หมากฮอส',
      'footer.contact': 'ติดต่อโฆษณา:',
      'footer.copy': '© 2026 Playmakruk.com',
      'footer.copyFree': '© 2026 Playmakruk.com — เล่นฟรี ดูฟรี',
      'footer.roomList': 'รายการห้อง',
      'footer.visits': 'ผู้เข้าชมทั้งหมด',
      'footer.online': 'ออนไลน์ตอนนี้',
      'footer.times': 'ครั้ง',
      'footer.people': 'คน',

      // Toast / errors
      'err.notYourTurn': 'ยังไม่ถึงตาคุณ',
      'err.invalidPos': 'ตำแหน่งไม่ถูกต้อง',
      'err.invalidPiece': 'หมากไม่ถูกต้อง',
      'err.cantMove': 'เดินไม่ได้',
      'err.notFound': 'ไม่พบห้องนี้',
      'err.playerOnly': 'เฉพาะผู้เล่นเท่านั้นที่เริ่มเกมใหม่ได้',
      'confirm.resign': 'ยอมแพ้เกมนี้?',
      'confirm.reset': 'เริ่มเกมใหม่?',
      'toast.copied': 'คัดลอกลิงก์แล้ว — ส่งให้เพื่อนได้เลย',
      'toast.copyFail': 'คัดลอกไม่ได้ — ',
      'prompt.privatePass': 'เป็นห้องส่วนตัว\nกรุณาใส่รหัสห้อง:',
    },

    en: {
      'logo.tagline': 'Chess / Checkers Online',
      'logo.tagline.rules': 'History & Rules',
      'lang.toggle': 'TH',
      'name.label': 'Name:',
      'name.placeholder': 'Set your name',
      'name.save': 'Save',
      'name.saved': '✓ Saved',
      'back': '← Back',

      'hero.title': 'Play Chess & Checkers Online',
      'hero.sub': 'Play, watch, chat — friendly atmosphere. Two players play, others watch and cheer in real-time chat.',
      'stat.rooms': 'rooms open',
      'stat.players': 'playing',
      'stat.viewers': 'watching',
      'stat.visits': 'total visitors',

      'create.gameType': '🎲 Game type',
      'gt.chess': '♛ Thai Chess',
      'gt.chess-intl': '♚ International Chess',
      'gt.checkers': '⛂ Thai Checkers',
      'gt.checkers-intl': '⛀ International Checkers',
      'create.roomName': 'Room name',
      'create.timeBase': '⏱ Time per side',
      'create.timeIncrement': '➕ Increment per move',
      'tc.none': 'Untimed',
      'tc.noinc': 'No inc.',
      'tc.min': 'm',
      'tc.hour': 'h',
      'tc.sec': 's',
      'create.password': '🔒 Password',
      'create.password.hint': '(set to make the room private)',
      'create.password.placeholder': 'Empty = public',
      'create.bot': '🤖 Play vs Bot (solo practice)',
      'bot.easy': '😊 Easy',
      'bot.medium': '🤔 Medium',
      'bot.hard': '🔥 Hard',
      'create.botColor': 'You play:',
      'side.white': '⚪ White (moves first)',
      'side.black': '⚫ Black',
      'create.button': '+ Open new room',

      'rooms.heading': 'Live rooms',
      'rooms.empty': 'No rooms yet — open one!',
      'room.live': '🔴 LIVE',
      'room.waiting': '⏳ Waiting',
      'room.ended': '✓ Ended',
      'room.private': '🔒 Private',
      'room.viewers': 'viewers',
      'room.players': 'players',
      'room.turnW': 'White to move',
      'room.turnB': 'Black to move',
      'room.join': 'Join →',

      'how.title': '📜 How to join',
      'how.1': 'Open a new room or join an existing one',
      'how.2': 'First 2 = players (white/black)',
      'how.3': 'Others = watch + chat live',
      'rulesShort.title': '♟ All 4 games — quick reference',
      'rulesShort.read': 'Read full history & rules →',

      'player.waiting': 'Waiting for player',
      'role.w': '⚪ You play White',
      'role.b': '⚫ You play Black',
      'role.viewer': '👁 You are watching',
      'role.connecting': 'Connecting...',
      'status.waiting': '⏳ Waiting for one more player',
      'status.ended': '🏁 Game ended',
      'status.turnW': 'White to move',
      'status.turnB': 'Black to move',
      'status.check': 'in check!',
      'status.continue': 'continue capture!',

      'btn.resign': '🏳 Resign',
      'btn.reset': '🔁 New game',
      'btn.flip': '↕ Flip board',
      'btn.share': '🔗 Share',
      'btn.theme': '🎨 Theme',
      'btn.pieces': '♟ Pieces',
      'theme.wood': 'Wood',
      'theme.green': 'Green',
      'theme.blue': 'Blue',
      'theme.purple': 'Purple',
      'theme.gray': 'Gray',
      'pieces.classic': 'Classic',
      'pieces.thai-carved': 'Thai Carved',
      'pieces.thai-letters': 'Thai Letters',
      'pieces.outline': 'Outline',
      'viewers.count': 'watching',

      'chat.live': 'Live chat',
      'chat.placeholder': 'Type a message...',
      'chat.send': 'Send',
      'chat.messages': 'messages',
      'viewers.title': 'Viewers',
      'viewers.empty': 'No viewers yet',
      'history.title': '📜 Move history',
      'history.empty': 'No moves yet',
      'rules.summary': '📖 Movement rules',
      'rules.readFull': 'Read full history & rules →',

      'footer.rules': 'Chess / Checkers rules',
      'footer.contact': 'Advertising contact:',
      'footer.copy': '© 2026 Playmakruk.com',
      'footer.copyFree': '© 2026 Playmakruk.com — free to play, free to watch',
      'footer.roomList': 'Room list',
      'footer.visits': 'Total visitors',
      'footer.online': 'Online now',
      'footer.times': '',
      'footer.people': '',

      'err.notYourTurn': 'Not your turn',
      'err.invalidPos': 'Invalid position',
      'err.invalidPiece': 'Invalid piece',
      'err.cantMove': 'Illegal move',
      'err.notFound': 'Room not found',
      'err.playerOnly': 'Only players can start a new game',
      'confirm.resign': 'Resign this game?',
      'confirm.reset': 'Start a new game?',
      'toast.copied': 'Link copied — share with friends',
      'toast.copyFail': 'Could not copy — ',
      'prompt.privatePass': 'is a private room\nPlease enter password:',
    },
  };

  let currentLang = localStorage.getItem('makruk_lang') || 'th';

  function t(key) {
    return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS.th[key] || key;
  }

  function getLang() { return currentLang; }

  function setLang(lang) {
    if (lang !== 'th' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem('makruk_lang', lang);
    document.documentElement.lang = lang;
    applyTranslations();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function toggleLang() { setLang(currentLang === 'th' ? 'en' : 'th'); }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });
    const btn = document.getElementById('langToggleBtn');
    if (btn) btn.textContent = currentLang === 'th' ? '🌐 EN' : '🌐 TH';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = currentLang;
    applyTranslations();
  });

  global.I18N = { t, setLang, getLang, toggleLang, applyTranslations };
})(typeof window !== 'undefined' ? window : globalThis);
