(function(global){
  'use strict';
  const catalogue={
    chess:{th:'วังหิมพานต์',en:'Himmapan palace',wide:'chess-wide-d57353bd35.webp',mobile:'chess-mobile-276aca243f.webp',thumb:'chess-thumb-11658c105e.webp'},
    'chess-intl':{th:'วังพงไพร',en:'Eldergrove palace',wide:'chess-intl-wide-a9f4a9b719.webp',mobile:'chess-intl-mobile-ba83021354.webp',thumb:'chess-intl-thumb-e3822073c9.webp'},
    checkers:{th:'ศาลาริมธาร',en:'Moonlit pavilion',wide:'checkers-wide-82e9f99037.webp',mobile:'checkers-mobile-54f80fffe1.webp',thumb:'checkers-thumb-47e58989a5.webp'},
    'checkers-intl':{th:'ปราการมังกร',en:'Dragon citadel',wide:'checkers-intl-wide-a516a35075.webp',mobile:'checkers-intl-mobile-b4626ca836.webp',thumb:'checkers-intl-thumb-32a718126c.webp'},
    connect4:{th:'หอดูดาวดารา',en:'Astral observatory',wide:'connect4-wide-a0c21c08e2.webp',mobile:'connect4-mobile-e89ca1e0aa.webp',thumb:'connect4-thumb-f563b1837e.webp'}
  };
  const url=file=>'/img/scenes/'+file,valid=id=>id==='auto'||id==='none'||Object.hasOwn(catalogue,id);
  let game=null,choice='auto',visible=false,request=0,currentURL='';
  const mobile=matchMedia('(max-width:700px)'),picker=document.getElementById('scenePicker'),options=document.getElementById('sceneOptions');
  function notify(){document.dispatchEvent(new CustomEvent('roomscenechange',{detail:{visible}}));}
  function apply(){
    const token=++request,key=choice==='auto'?game:choice,item=catalogue[key];
    if(!item){visible=false;currentURL='';document.body.classList.remove('has-room-scene');document.body.style.removeProperty('--room-scene');notify();return;}
    const src=url(item[mobile.matches?'mobile':'wide']);if(currentURL===src&&visible)return;
    // A failed or late decorative download cannot block or overwrite a game.
    const img=new Image();img.decoding='async';
    img.onload=()=>{if(token!==request)return;currentURL=src;visible=true;document.body.style.setProperty('--room-scene',`url("${src}")`);document.body.classList.add('has-room-scene');document.body.dataset.roomScene=key;notify();};
    img.onerror=()=>{if(token!==request)return;visible=false;currentURL='';document.body.classList.remove('has-room-scene');notify();};img.src=src;
  }
  function render(){
    if(!options)return;const th=global.I18N.getLang()==='th';
    picker.querySelector('summary span').textContent=th?'ฉากหลัง':'Scenery';
    const entries=[['auto',th?'ตามเกม':'Match game'],['none',th?'พื้นเรียบ':'Plain'],...Object.entries(catalogue).map(([id,s])=>[id,s[th?'th':'en']])];
    options.replaceChildren(...entries.map(([id,label])=>{const button=document.createElement('button');button.type='button';button.dataset.scene=id;button.className='scene-option';button.setAttribute('aria-pressed',String(choice===id));
      const art=document.createElement('span');art.className='scene-thumb';const item=catalogue[id==='auto'?game:id];if(item){const image=document.createElement('img');image.src=url(item.thumb);image.alt='';image.loading='lazy';image.width=360;image.height=203;art.append(image);}else art.textContent=id==='none'?'○':'✦';
      const text=document.createElement('span');text.textContent=label;button.append(art,text);button.onclick=()=>{choice=id;try{localStorage.setItem('makruk_scene_'+game,id);}catch{}apply();render();picker.open=false;picker.querySelector('summary').focus({preventScroll:true});};return button;}));
  }
  function setGame(id){if(game===id)return;game=Object.hasOwn(catalogue,id)?id:'chess';let saved;try{saved=localStorage.getItem('makruk_scene_'+game);}catch{}choice=valid(saved)?saved:'auto';render();apply();}
  mobile.addEventListener('change',()=>{if(game)apply();});document.addEventListener('langchange',render);
  global.RoomScenes={setGame,isVisible:()=>visible,catalogue};
})(window);
