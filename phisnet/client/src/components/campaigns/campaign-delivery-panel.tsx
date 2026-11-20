import { useState } from 'react';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import CampaignEventTimeline from './campaign-event-timeline';

interface Delivery {status:string;states:{state:string;provider_state:string;count:number}[];ambiguous:{target_id:number;email:string;error_code:string}[]}
export default function CampaignDeliveryPanel({id}:{id:number}) {
  const cache=useQueryClient();const [error,setError]=useState('');
  const {data}=useQuery<Delivery>({queryKey:[`/api/campaigns/${id}/delivery`],refetchInterval:5000});
  const action=useMutation({mutationFn:async(name:string)=>(await apiRequest('POST',`/api/campaigns/${id}/${name}`)).json(),onSuccess:()=>{void cache.invalidateQueries({queryKey:[`/api/campaigns/${id}/delivery`]});void cache.invalidateQueries({queryKey:['/api/campaigns']});},onError:(failure:Error)=>setError(failure.message)});
  const reconcile=useMutation({mutationFn:async({targetId,decision}:{targetId:number;decision:string})=>(await apiRequest('POST',`/api/campaigns/${id}/recipients/${targetId}/reconcile`,{decision})).json(),onSuccess:()=>void cache.invalidateQueries({queryKey:[`/api/campaigns/${id}/delivery`]}),onError:(failure:Error)=>setError(failure.message)});
  return <section className="space-y-3 rounded border p-4"><h3 className="text-lg font-semibold">Delivery health</h3>{error&&<p role="alert" className="text-destructive">{error}</p>}
    <p className="text-sm text-muted-foreground">Accepted means the sending transport accepted the message. Confirmed delivery is reported separately when the provider supplies it.</p>
    <div className="flex flex-wrap gap-3">{data?.states.map(item=><span key={item.state+item.provider_state} className="rounded bg-muted px-3 py-2 text-sm">{item.state}{item.provider_state!=='unknown'?` / ${item.provider_state}`:''}: {item.count}</span>)}</div>
    <div className="flex gap-3">{data?.status==='Active'&&<Button variant="outline" disabled={action.isPending} onClick={()=>action.mutate('pause')}>Pause delivery</Button>}{data?.status==='Paused'&&<Button disabled={action.isPending} onClick={()=>action.mutate('resume')}>Resume delivery</Button>}{['Active','Paused','Scheduled'].includes(data?.status||'')&&<Button variant="destructive" disabled={action.isPending} onClick={()=>action.mutate('cancel')}>Cancel campaign</Button>}</div>
    {!!data?.ambiguous.length&&<div className="space-y-2"><h4 className="font-medium">Delivery needs review</h4><p className="text-sm">These messages may have reached the recipient. Check provider logs before resolving them.</p>{data.ambiguous.map(item=><div key={item.target_id} className="flex flex-wrap items-center gap-2 rounded border p-2"><span className="mr-auto text-sm">{item.email}: {item.error_code}</span><Button size="sm" variant="outline" disabled={reconcile.isPending} onClick={()=>reconcile.mutate({targetId:item.target_id,decision:'mark_accepted'})}>Mark accepted</Button><Button size="sm" variant="outline" disabled={reconcile.isPending} onClick={()=>reconcile.mutate({targetId:item.target_id,decision:'mark_failed'})}>Mark failed</Button></div>)}</div>}
    <CampaignEventTimeline id={id}/>
  </section>;
}
