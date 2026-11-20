import { useState } from 'react';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/app-layout';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TrainingAssignmentsPage() {
  const [moduleId,setModuleId]=useState('');const [userIds,setUserIds]=useState<number[]>([]);const [days,setDays]=useState(7);const [error,setError]=useState('');const cache=useQueryClient();
  const {data:users=[]}=useQuery<{id:number;email:string;isActive:boolean}[]>({queryKey:['/api/users']});
  const {data:modules}=useQuery<{modules:{id:number;title:string}[]}>({queryKey:['/api/admin/training-modules']});
  const {data}=useQuery<{assignments:{id:number;email:string;title:string;status:string;due_at:string}[]}>({queryKey:['/api/admin/training-assignments']});
  const assign=useMutation({mutationFn:async()=>(await apiRequest('POST','/api/admin/training-assignments',{userIds,moduleId:Number(moduleId),dueDays:days})).json(),onSuccess:()=>{setUserIds([]);setError('');void cache.invalidateQueries({queryKey:['/api/admin/training-assignments']});},onError:(failure:Error)=>setError(failure.message)});
  return <AppLayout><div className="space-y-6"><h1 className="text-3xl font-bold">Training assignments</h1><p className="text-muted-foreground">Assign training directly or review training assigned by your campaigns.</p>{error&&<p role="alert" className="text-destructive">{error}</p>}
    <form className="space-y-4 rounded border p-5" onSubmit={event=>{event.preventDefault();assign.mutate();}}><label className="block">Training module<select required className="mt-2 block w-full rounded border bg-background p-2" value={moduleId} onChange={event=>setModuleId(event.target.value)}><option value="">Select a module</option>{modules?.modules.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="block">Due within days<Input type="number" min={1} max={365} required value={days} onChange={event=>setDays(Number(event.target.value))}/></label>
      <fieldset className="max-h-56 space-y-2 overflow-auto"><legend>Employees</legend>{users.filter(user=>user.isActive).map(user=><label key={user.id} className="flex gap-2"><input type="checkbox" checked={userIds.includes(user.id)} onChange={event=>setUserIds(previous=>event.target.checked?[...previous,user.id]:previous.filter(id=>id!==user.id))}/>{user.email}</label>)}</fieldset><Button disabled={!userIds.length||!moduleId||assign.isPending}>Assign training</Button></form>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Employee</th><th>Module</th><th>Status</th><th>Due</th></tr></thead><tbody>{data?.assignments.map(item=><tr key={item.id} className="border-t"><td className="p-2">{item.email}</td><td>{item.title}</td><td>{item.status}</td><td>{new Date(item.due_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
  </div></AppLayout>;
}
