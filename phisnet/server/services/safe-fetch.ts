import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

export function isPublicAddress(ip:string) {
 if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===198&&(b===18||b===19||b===51)||a===203&&b===0||a===100&&b>=64&&b<=127);}
 // Only global unicast IPv6. Exclude documentation and IPv4 tunnelling ranges.
 return isIP(ip)===6&&/^[23]/i.test(ip)&&!/^2001:(db8|0:)/i.test(ip)&&!/^2002:/i.test(ip);
}
export async function safeFetchText(input:string,redirects=0):Promise<string> {
 const url=new URL(input);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port))throw new Error('Only public HTTP/HTTPS URLs on standard ports are supported');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});
 if(!addresses.length||addresses.some(v=>!isPublicAddress(v.address)))throw new Error('Private and reserved network addresses are not allowed');
 const selected=addresses[0];
 return new Promise<string>((resolve,reject)=>{
   const request=(url.protocol==='https:'?https:http).request(url,{method:'GET',headers:{'User-Agent':'PhishNet-Content-Importer/1.0','Accept':'text/html','Accept-Encoding':'identity'},
     // Pin the validated address; a second DNS lookup cannot switch to an internal IP.
     lookup:((_host:any,options:any,callback:any)=>callback(null,options?.all?[selected]:selected.address,selected.family)) as any},response=>{
     const status=response.statusCode||0;
     if(status>=300&&status<400&&response.headers.location){response.resume();if(redirects>=3)return reject(new Error('Too many redirects'));void safeFetchText(new URL(response.headers.location,url).href,redirects+1).then(resolve,reject);return;}
     if(status<200||status>=300){response.resume();return reject(new Error(`Remote server returned ${status}`));}
     if(!/text\/(html|plain)|application\/xhtml/i.test(response.headers['content-type']||'')){response.resume();return reject(new Error('Remote content must be HTML or text'));}
     const chunks:Buffer[]=[];let length=0;
     response.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>2*1024*1024){request.destroy(new Error('Remote content exceeds 2 MB'));return;}chunks.push(chunk);});
     response.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));response.on('error',reject);
   });
   const timer=setTimeout(()=>request.destroy(new Error('Remote fetch timed out')),10000);request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end();
 });
}
