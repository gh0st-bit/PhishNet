import {Redirect,useLocation} from 'wouter';
import {RefreshButton} from '@/components/ui/refresh-button';
import {useState} from 'react';
import {useQuery,useQueryClient,useMutation} from '@tanstack/react-query';
import {apiRequest} from '@/lib/queryClient';
import {useAuth} from '@/hooks/use-auth';
import {appRole} from '@shared/access-control';
import AppLayout from '@/components/layout/app-layout';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';

export function LocalInboxContent(){
  const {user}=useAuth(),management=['Admin','OrgAdmin'].includes(appRole(user)),cache=useQueryClient();
  const [selected,setSelected]=useState<number|null>(null),[name,setName]=useState('Local awareness demonstration'),[ids,setIds]=useState<number[]>([]),[notice,setNotice]=useState('');
  const status=useQuery({queryKey:['/api/lab/status'],queryFn:async()=>(await apiRequest('GET','/api/lab/status')).json()});
  const enabled=status.data?.enabled;
  const recipients=useQuery({queryKey:['/api/lab/recipients'],enabled:!!enabled&&management,queryFn:async()=>(await apiRequest('GET','/api/lab/recipients')).json()});
  const messages=useQuery({queryKey:['/api/lab/messages'],enabled:!!enabled,queryFn:async()=>(await apiRequest('GET','/api/lab/messages')).json(),refetchInterval:3000});
  const detail=useQuery({queryKey:['/api/lab/messages',selected],enabled:!!enabled&&!!selected,queryFn:async()=>(await apiRequest('GET',`/api/lab/messages/${selected}`)).json()});
  const create=useMutation({mutationFn:async()=>(await apiRequest('POST','/api/lab/campaigns',{name,userIds:ids})).json(),onSuccess:data=>{setNotice(`Campaign ${data.campaignId} queued for ${data.queued} local recipient(s). The delivery worker will add the messages below.`);cache.invalidateQueries({queryKey:['/api/dashboard/overview']});},onError:e=>setNotice(e.message)});
  const action=useMutation({mutationFn:async(kind:string)=>(await apiRequest('POST',`/api/lab/messages/${selected}/${kind}`)).json(),onSuccess:(_data,kind)=>{setNotice(kind==='report'?'Message reported. Thank you for reporting suspicious mail.':'Opening recorded.');cache.invalidateQueries({queryKey:['/api/lab/messages']});cache.invalidateQueries({queryKey:['/api/dashboard/overview']});},onError:e=>setNotice(e.message)});
  const own=detail.data?.recipient_email.toLowerCase()===user?.email.toLowerCase();
  return <div className="space-y-5"><h1 className="text-2xl font-bold">{management?"Local simulation inbox":"My inbox"}</h1><p className="text-muted-foreground">Controlled practice messages, tracked training links and a harmless text attachment. No mail is sent to external email services.</p>
    {!enabled&&<Card className="p-5"><h2 className="font-semibold">Start the local lab</h2><p>Run <code>./start-local-lab.ps1</code> on this PC. For a second laptop, use <code>./start-local-lab.ps1 -Lan</code> and open the printed private-network URL on both devices.</p></Card>}
    {enabled&&<><Card className="p-4 text-sm">Local lab active · {status.data.baseUrl} · mail stays in this application. Sign in as the selected recipient to record opens, reports and downloads. Previewing someone else's message does not change results.</Card>
      {management&&<Card className="p-5 space-y-3"><h2 className="font-semibold">Create a practice campaign</h2><label className="block">Campaign name<input className="mt-1 w-full rounded border p-2 bg-background" value={name} onChange={e=>setName(e.target.value)}/></label><fieldset className="space-y-2"><legend>Local recipients (up to 20)</legend><div className="grid md:grid-cols-2 max-h-52 overflow-y-auto">{recipients.data?.map((u:any)=><label key={u.id} className="flex items-center gap-2 p-1"><input type="checkbox" checked={ids.includes(u.id)} onChange={e=>setIds(e.target.checked?[...ids,u.id]:ids.filter(id=>id!==u.id))}/>{u.email}</label>)}</div></fieldset><Button disabled={!ids.length||!name.trim()||ids.length>20||create.isPending} onClick={()=>create.mutate()}>Send local simulation</Button></Card>}
      {notice&&<p role="status" className="rounded border p-3">{notice}</p>}
      <div className="grid lg:grid-cols-2 gap-4"><Card className="p-4 space-y-3"><div className="flex justify-between"><h2 className="font-semibold">Received messages</h2><RefreshButton onRefresh={()=>Promise.all([status.refetch({throwOnError:true}),...(enabled?[messages.refetch({throwOnError:true}),...(selected?[detail.refetch({throwOnError:true})]:[])]:[])])}>Refresh inbox</RefreshButton></div>{messages.isLoading&&<p>Loading inbox...</p>}{messages.error&&<p role="alert">Unable to load messages. Refresh to retry.</p>}{messages.data?.map((m:any)=><button type="button" key={m.id} onClick={()=>{setSelected(m.id);setNotice('');}} className="w-full border rounded p-3 text-left hover:bg-secondary"><strong>{m.subject}</strong><p className="text-sm">{m.recipient_email}</p><p className="text-xs text-muted-foreground">{m.campaign_name} · {m.reported?'Reported':m.opened_at?'Opened':'Unread'}{!m.delivery_accepted?' · delivery processing':''}</p></button>)}{messages.data?.length===0&&<p>{management?'No messages yet. Create a practice campaign when you are ready.':'No messages yet. Your manager can send a practice message to your account.'}</p>}</Card>
      <Card className="p-4 space-y-3"><h2 className="font-semibold">Message preview</h2>{!selected&&<p>Select a message. Listing and previewing do not load tracking pixels.</p>}{detail.isLoading&&<p>Loading message...</p>}{detail.error&&<p role="alert">Message unavailable.</p>}{detail.data&&<><p className="text-sm">From: {detail.data.sender_email}<br/>To: {detail.data.recipient_email}</p><iframe title="Local email preview" className="h-72 w-full bg-white border rounded" sandbox="" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'"><style>body{font:16px/1.5 system-ui;padding:12px}</style></head><body>${detail.data.html_content}</body></html>`}/>
        {own?<div className="flex flex-wrap gap-2"><Button disabled={!detail.data.delivery_accepted||action.isPending} onClick={()=>action.mutate('open')}>Open message (record read)</Button><Button variant="outline" disabled={action.isPending} onClick={()=>action.mutate('report')}>Report suspicious</Button><a className="rounded border p-2 text-sm underline" href={detail.data.simulationUrl} target="_blank" rel="noopener noreferrer">Open simulation link</a><a className="rounded border p-2 text-sm underline" href={`/api/lab/messages/${selected}/attachment`}>Download harmless attachment</a></div>:<p className="text-sm">Operator preview. Recipient actions are available only when signed in as {detail.data.recipient_email}.</p>}
        <p className="text-xs text-muted-foreground">The attachment is a text file. A download records a download event, not code execution. Use only the training code DEMO on the practice landing page.</p></>}</Card></div>
    </>}
  </div>;
}

export default function LocalInboxPage(){
 const {user}=useAuth();const [location]=useLocation();
 if(appRole(user)==='User'&&location==='/local-inbox')return <Redirect to="/employee/inbox"/>;
 return <AppLayout><LocalInboxContent/></AppLayout>;
}
