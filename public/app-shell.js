(function(){
  const frame=document.getElementById('appFrame');let current=location.href;
  const routes=new Set(['/','/index.html','/room.html','/rules.html']);
  function clean(value){const url=new URL(value,location.href);url.searchParams.delete('_view');if(url.origin!==location.origin||!routes.has(url.pathname))throw Error('Unsupported app route');return url;}
  function load(value){const url=clean(value);current=url.href;url.searchParams.set('_view','content');document.getElementById('navigationStatus').hidden=false;
    if(frame.contentWindow)frame.contentWindow.location.replace(url.href);else frame.src=url.href;
  }
  window.PlaymakrukShell={navigate(value){const url=clean(value);if(url.href===current)return;history.pushState({playmakruk:true},'',url.href);load(url.href);},ready(value,title){if(clean(value).href!==current)return;document.title=title;document.getElementById('navigationStatus').hidden=true;}};
  history.replaceState({playmakruk:true},'',clean(location.href).href);
  window.addEventListener('popstate',()=>load(location.href));
  frame.addEventListener('load',()=>{document.getElementById('navigationStatus').hidden=true;});
  frame.addEventListener('error',()=>{const status=document.getElementById('navigationStatus');status.hidden=false;status.textContent='โหลดหน้าไม่สำเร็จ ลองรีเฟรชอีกครั้ง';});
  load(location.href);
})();
