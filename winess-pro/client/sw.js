const scopeUrl=self.registration.scope;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={title:'Nouveauté Winess PRO',body:'Découvrez votre nouvelle sélection.',url:scopeUrl};
 try{if(event.data)data=event.data.json()}catch(e){if(event.data)data.body=event.data.text()}
 const target=new URL(data.url||scopeUrl,self.location.origin);
 if(target.origin!==self.location.origin||!target.pathname.startsWith('/WINESS-HUB/winess-pro/client/'))target.href=scopeUrl;
 event.waitUntil(self.registration.showNotification(data.title||'Winess PRO',{
  body:data.body||'Une nouveauté vous attend dans votre catalogue.',
  icon:'./icon.svg',badge:'./icon.svg',tag:'winess-new-arrival',renotify:true,
  data:{url:target.href}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=event.notification.data?.url||scopeUrl;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  const existing=list.find(c=>c.url.startsWith(scopeUrl));
  if(existing){return existing.navigate(url).then(c=>c?.focus())}
  return self.clients.openWindow(url)
 }));
});