import { useEffect,useRef,useState } from 'react';
import { Button } from './button';

interface HtmlEditorProps {
  setContents?:string;defaultValue?:string;onChange?:(html:string)=>void;onBlur?:()=>void;
  getSunEditorInstance?:(editor:{getContents:()=>string;setContents:(html:string)=>void})=>void;
  setOptions?:Record<string,unknown>;height?:string;[key:string]:unknown;
}
export default function HtmlEditor(props:HtmlEditorProps) {
  const [content,setContent]=useState(props.setContents??props.defaultValue??'');const [preview,setPreview]=useState(false);
  const input=useRef<HTMLTextAreaElement>(null);const value=useRef(content);const onChange=useRef(props.onChange);onChange.current=props.onChange;
  const update=(html:string)=>{value.current=html;setContent(html);onChange.current?.(html);};
  useEffect(()=>{if(props.setContents!==undefined&&props.setContents!==value.current){value.current=props.setContents;setContent(props.setContents);}},[props.setContents]);
  const instance=useRef({getContents:()=>value.current,setContents:(html:string)=>update(html)});
  useEffect(()=>{props.getSunEditorInstance?.(instance.current);},[]);
  const insert=(tag:string)=>{
    const start=input.current?.selectionStart||0,end=input.current?.selectionEnd||0;
    update(content.slice(0,start)+`<${tag}>`+content.slice(start,end)+`</${tag}>`+content.slice(end));input.current?.focus();
  };
  const height=props.height||String(props.setOptions?.height||'300px');
  const policy="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'\">";
  return <div className="flex h-full min-h-64 flex-col rounded border bg-background glass-field">
    <div className="flex flex-wrap gap-2 border-b p-2" role="toolbar" aria-label="HTML editing tools"><Button size="sm" variant="outline" type="button" onClick={()=>insert('strong')}>Bold</Button><Button size="sm" variant="outline" type="button" onClick={()=>insert('em')}>Italic</Button><Button size="sm" variant="outline" type="button" onClick={()=>insert('p')}>Paragraph</Button><Button size="sm" variant="outline" type="button" aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?'Edit HTML':'Preview HTML'}</Button></div>
    {preview?<iframe title="HTML preview" sandbox="" referrerPolicy="no-referrer" className="min-h-52 w-full flex-1 bg-white" style={{height}} srcDoc={`<!doctype html><html><head>${policy}</head><body>${content}</body></html>`}/>:<textarea ref={input} aria-label="HTML content" spellCheck={false} className="min-h-52 w-full flex-1 resize-y bg-transparent p-3 font-mono text-sm text-foreground" style={{height}} value={content} onChange={event=>update(event.target.value)} onBlur={props.onBlur}/>}
  </div>;
}
