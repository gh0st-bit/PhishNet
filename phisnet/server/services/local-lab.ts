import type { RequestHandler } from 'express';
export function privateAddress(address:string) {
  const ip=address.replace(/^::ffff:/,'');
  if(ip==='::1')return true;
  const parts=ip.split('.').map(Number);
  return parts.length===4&&parts.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&(parts[0]===127||parts[0]===10||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31);
}
export function labEnabled() {
  return process.env.LOCAL_MAILBOX_ENABLED==='true'&&process.env.MAIL_TRANSPORT==='sink'&&process.env.NODE_ENV!=='production'&&new URL(process.env.DATABASE_URL||'postgres://localhost/none').pathname==='/phishnet_audit';
}
export const localNetworkOnly:RequestHandler=(req,res,next)=>{
  if(process.env.LOCAL_MAILBOX_ENABLED!=='true')return next();
  if(!labEnabled())return res.status(503).send('Local lab requires the isolated audit database and mail sink');
  if(!privateAddress(req.socket.remoteAddress||''))return res.status(403).send('Local lab is available only on a private local network');
  next();
};
