/* global Office */
Office.onReady(function () {
  const status=document.getElementById('status'),link=document.getElementById('report');
  const item=Office.context.mailbox&&Office.context.mailbox.item;
  if(!item||!item.internetMessageId){status.textContent='The message identifier is unavailable. Open a received message or use the Report message page.';return;}
  const url=new URL('/employee/report',window.location.origin);
  url.searchParams.set('messageKey',item.internetMessageId);
  url.searchParams.set('subject',(item.subject||'').slice(0,300));
  link.href=url.href;link.hidden=false;status.textContent='Review this report in your authenticated PhishNet workspace.';
});
