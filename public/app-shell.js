(function(){
  const frame=document.getElementById('appFrame');let current=location.href;
  // Browser toolbars and keyboards change the visible area independently of
  // 100vh/100dvh in iOS web views. Size the shell, never reload the audio/frame.
  let viewportFrame=0;
  function fitViewport(){
    viewportFrame=0;
    const viewport=window.visualViewport;
    // Preserve native pinch zoom: zooming must not relayout the page underneath.
    if(viewport&&Math.abs(viewport.scale-1)>.01)return;
    const height=viewport?.height||window.innerHeight;
    if(height>0){
      document.documentElement.style.setProperty('--app-viewport-height',height+'px');
      document.documentElement.style.setProperty('--app-viewport-top',Math.max(0,viewport?.offsetTop||0)+'px');
    }
  }
  function scheduleViewport(){if(!viewportFrame)viewportFrame=requestAnimationFrame(fitViewport);}
  window.visualViewport?.addEventListener('resize',scheduleViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',scheduleViewport,{passive:true});
  window.addEventListener('resize',scheduleViewport,{passive:true});
  window.addEventListener('pageshow',scheduleViewport);
  fitViewport();
  const routes=new Set(['/','/index.html','/room.html','/rules.html']);
  function clean(value){const url=new URL(value,location.href);url.searchParams.delete('_view');if(url.origin!==location.origin||!routes.has(url.pathname))throw Error('Unsupported app route');return url;}
  function load(value){const url=clean(value);current=url.href;url.searchParams.set('_view','content');document.getElementById('navigationStatus').hidden=false;
    document.body.classList.remove('content-modal-open');
    window.Radio?.close(false);
    if(frame.contentWindow)frame.contentWindow.location.replace(url.href);else frame.src=url.href;
  }
  window.PlaymakrukShell={version:document.querySelector('meta[name="playmakruk-build"]')?.content,setModalOpen(open){document.body.classList.toggle('content-modal-open',!!open);},navigate(value){const url=clean(value);if(url.href===current)return;history.pushState({playmakruk:true},'',url.href);load(url.href);},ready(value,title){if(clean(value).href!==current)return;document.title=title;document.getElementById('navigationStatus').hidden=true;}};
  history.replaceState({playmakruk:true},'',clean(location.href).href);
  window.addEventListener('popstate',()=>load(location.href));
  frame.addEventListener('load',()=>{document.getElementById('navigationStatus').hidden=true;});
  frame.addEventListener('error',()=>{const status=document.getElementById('navigationStatus');status.hidden=false;status.textContent='โหลดหน้าไม่สำเร็จ ลองรีเฟรชอีกครั้ง';});
  load(location.href);
})();
