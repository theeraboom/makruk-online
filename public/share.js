(function(root){
 function links(origin,roomId,isPrivate,password){const website=new URL('/',origin).href;const room=new URL('/room.html',origin);room.searchParams.set('id',roomId);if(isPrivate&&password)room.searchParams.set('pw',password);return{website,room:room.href};}
 async function send(navigator,data){if(navigator.share){try{await navigator.share(data);return 'shared';}catch(error){if(error.name==='AbortError')return 'cancelled';}}await navigator.clipboard.writeText(data.url);return 'copied';}
 const api={links,send};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ShareLinks=api;
})(typeof window!=='undefined'?window:globalThis);
