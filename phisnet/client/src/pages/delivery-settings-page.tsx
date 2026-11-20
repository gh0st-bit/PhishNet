import { useState } from 'react';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/app-layout';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Domain {id:number;domain:string;challenge:string;verified_at:string|null}
export default function DeliverySettingsPage() {
  const cache=useQueryClient();const [domain,setDomain]=useState('');const [error,setError]=useState('');
  const [sender,setSender]=useState({name:'',fromEmail:'',fromName:''});
  const {data}=useQuery<{domains:Domain[]}>({queryKey:['/api/delivery/domains']});
  const {data:capabilities}=useQuery<{managedAvailable:boolean}>({queryKey:['/api/delivery/capabilities']});
  const {data:suppressed}=useQuery<{suppressions:{email:string;reason:string}[]}>({queryKey:['/api/delivery/suppressions']});
  const create=useMutation({mutationFn:async()=>(await apiRequest('POST','/api/delivery/domains',{domain})).json(),onSuccess:()=>{setDomain('');void cache.invalidateQueries({queryKey:['/api/delivery/domains']});},onError:(failure:Error)=>setError(failure.message)});
  const verify=useMutation({mutationFn:async(id:number)=>(await apiRequest('POST',`/api/delivery/domains/${id}/verify`)).json(),onSuccess:()=>{setError('');void cache.invalidateQueries({queryKey:['/api/delivery/domains']});},onError:(failure:Error)=>setError(failure.message)});
  const managed=useMutation({mutationFn:async()=>(await apiRequest('POST','/api/delivery/managed-profile',sender)).json(),onSuccess:()=>{setSender({name:'',fromEmail:'',fromName:''});void cache.invalidateQueries({queryKey:['/api/smtp-profiles']});},onError:(failure:Error)=>setError(failure.message)});
  return <AppLayout><div className="space-y-6"><h1 className="text-3xl font-bold">Email delivery</h1>{error&&<p role="alert" className="text-destructive">{error}</p>}
    <section className="space-y-4 rounded border p-5"><h2 className="text-xl font-semibold">Verify your domains</h2><p className="text-sm text-muted-foreground">Verify ownership of sender and recipient domains before production campaigns. Verification is valid for 90 days.</p>
      <form className="flex flex-wrap gap-3" onSubmit={event=>{event.preventDefault();create.mutate();}}><label>Domain<Input placeholder="example.com" value={domain} onChange={event=>setDomain(event.target.value)} required/></label><Button className="self-end" disabled={create.isPending}>Add domain</Button></form>
      {data?.domains.map(item=><article key={item.id} className="space-y-2 rounded bg-muted p-4"><h3 className="font-medium">{item.domain}</h3><p>{item.verified_at?'Verified':'Awaiting verification'}</p><p className="text-sm">Create a TXT record at <code>_phishnet-verification.{item.domain}</code> with this value:</p><code className="block break-all text-sm">{item.challenge}</code><Button variant="outline" disabled={verify.isPending} onClick={()=>verify.mutate(item.id)}>Check DNS record</Button></article>)}
    </section><section className="space-y-4 rounded border p-5"><h2 className="text-xl font-semibold">Managed sending profile</h2><p className="text-sm text-muted-foreground">Managed delivery is available after the platform operator configures a provider approved for authorized simulations.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={event=>{event.preventDefault();managed.mutate();}}>{(['name','fromName','fromEmail'] as const).map(key=><label key={key}>{key==='name'?'Profile name':key==='fromName'?'Sender name':'Sender email'}<Input type={key==='fromEmail'?'email':'text'} required value={sender[key]} onChange={event=>setSender(previous=>({...previous,[key]:event.target.value}))}/></label>)}<Button className="self-end" disabled={!capabilities?.managedAvailable||managed.isPending}>Create managed profile</Button></form>
    </section><section className="space-y-3 rounded border p-5"><h2 className="text-xl font-semibold">Suppressed recipients</h2><p className="text-sm text-muted-foreground">Recipients with bounce or complaint events are excluded from later sends.</p>{suppressed?.suppressions.length?<ul>{suppressed.suppressions.map(item=><li key={item.email}>{item.email}: {item.reason}</li>)}</ul>:<p>No suppressed recipients.</p>}</section>
  </div></AppLayout>;
}
