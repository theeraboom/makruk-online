/* In-frame navigation keeps the top-level radio and audio context alive. */
(function(){
  let host=null;try{if(parent!==window&&parent.PlaymakrukShell)host=parent.PlaymakrukShell;}catch{}
  function publicUrl(value=location.href){const url=new URL(value,location.href);url.searchParams.delete('_view');return url;}
  window.AppNavigation={go(value){const url=publicUrl(value);if(host)host.navigate(url.href);else location.assign(url.href);},publicUrl};
  if(!host){if(parent===window&&new URL(location.href).searchParams.has('_view'))location.replace(publicUrl().href);return;}
  window.Radio={open:()=>parent.Radio?.open(),pause:()=>parent.Radio?.pause()};
  Object.defineProperty(window,'GameAudio',{get:()=>parent.GameAudio});
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||link.target==='_blank'||link.getAttribute('href').startsWith('#'))return;
    const url=publicUrl(link.href);if(url.origin!==location.origin||!['/','/index.html','/room.html','/rules.html'].includes(url.pathname))return;
    event.preventDefault();host.navigate(url.href);
  });
  const unlock=()=>parent.GameAudio?.unlock();
  document.addEventListener('pointerdown',()=>{unlock();parent.Radio?.close(false);},{capture:true,passive:true});document.addEventListener('keydown',e=>{unlock();if(e.key==='Escape')parent.Radio?.close(false);},{capture:true});
  document.addEventListener('langchange',()=>{const lang=window.I18N?.getLang();if(lang&&parent.I18N?.getLang()!==lang)parent.I18N.setLang(lang);});
  document.addEventListener('themechange',()=>{const dark=document.documentElement.dataset.theme==='dark';if(dark)parent.document.documentElement.dataset.theme='dark';else parent.document.documentElement.removeAttribute('data-theme');});
  document.addEventListener('DOMContentLoaded',()=>{host.ready(publicUrl().href,document.title);});
})();
