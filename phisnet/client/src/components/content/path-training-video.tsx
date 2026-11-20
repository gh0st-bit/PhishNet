import {useState} from 'react';
export default function PathTrainingVideo({url}:{url?:string}){
 const [failed,setFailed]=useState(false);if(!url)return null;
 let parsed:URL;try{parsed=new URL(url,window.location.origin);}catch{return <p role="alert">The video address is invalid. Use the lesson transcript.</p>;}
 if(!['http:','https:'].includes(parsed.protocol))return <p role="alert">The video address is not supported. Use the transcript.</p>;
 const youtube=['youtube.com','www.youtube.com','youtu.be'].includes(parsed.hostname),id=parsed.hostname==='youtu.be'?parsed.pathname.slice(1):parsed.searchParams.get('v')||parsed.pathname.split('/').at(-1);
 return youtube&&id&&/^[A-Za-z0-9_-]{6,20}$/.test(id)?<iframe title="Assigned training video" className="w-full aspect-video" src={'https://www.youtube-nocookie.com/embed/'+id} allowFullScreen/>:<><video className="w-full max-h-96" controls src={parsed.href} onError={()=>setFailed(true)}/>{failed&&<p role="alert">Video could not load. Read the transcript or contact your training administrator.</p>}</>;
}
