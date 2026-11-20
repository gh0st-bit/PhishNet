import { useEffect,useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { useTenantPreferences,type TenantPreferences } from '@/hooks/use-tenant-preferences';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export default function TenantSettingsPage(){
 const {data,isLoading,error}=useTenantPreferences();const client=useQueryClient();const [form,setForm]=useState<TenantPreferences>();
 useEffect(()=>{if(data)setForm(data);},[data]);
 const save=useMutation({mutationFn:async()=>{const result=await apiRequest('PUT','/api/organization/preferences',form);return result.json();},onSuccess:result=>client.setQueryData(['/api/organization/preferences'],result)});
 return <AppLayout title="Organization preferences">{isLoading?<p role="status">Loading preferences...</p>:error?<p role="alert">Preferences could not be loaded.</p>:form&&<form className="max-w-xl space-y-5" onSubmit={event=>{event.preventDefault();save.mutate();}}>
 <div><Label htmlFor="brand-name">Organization display name</Label><Input id="brand-name" value={form.brandName} maxLength={100} onChange={event=>setForm({...form,brandName:event.target.value})}/></div>
 <div><Label htmlFor="tenant-locale">Language and date format</Label><select id="tenant-locale" className="block w-full rounded border bg-background p-2" value={form.locale} onChange={event=>setForm({...form,locale:event.target.value})}>{[['en-US','English (United States)'],['en-GB','English (United Kingdom)'],['fr-FR','Français'],['es-ES','Español'],['ur-PK','اردو']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><p className="mt-1 text-sm text-muted-foreground">Navigation and regional date formatting are localized. Course and template content keeps its authored language.</p></div>
 <div><Label htmlFor="tenant-zone">Default timezone (IANA)</Label><Input id="tenant-zone" value={form.timezone} onChange={event=>setForm({...form,timezone:event.target.value})} placeholder="Asia/Karachi"/></div>
 <div><Label htmlFor="tenant-accent">Accent color</Label><Input id="tenant-accent" type="color" value={form.accentColor} onChange={event=>setForm({...form,accentColor:event.target.value})}/></div>
 <div><Label htmlFor="capture-retention">Captured secret retention (days)</Label><Input id="capture-retention" type="number" min={1} max={30} value={form.captureRetentionDays} onChange={event=>setForm({...form,captureRetentionDays:Number(event.target.value)})}/><p className="text-sm text-muted-foreground">The platform retention ceiling can shorten this period. Erasure preserves aggregate training and simulation outcomes.</p></div>
 <div><Label htmlFor="general-retention">Audit and notification retention (days)</Label><Input id="general-retention" type="number" min={1} max={3650} value={form.dataRetentionDays} onChange={event=>setForm({...form,dataRetentionDays:Number(event.target.value)})}/></div>
 <label className="flex gap-2"><input type="checkbox" checked={Boolean(form.leaderboardEnabled)} onChange={event=>setForm({...form,leaderboardEnabled:event.target.checked})}/>Enable the organization leaderboard for employees</label><p className="text-sm text-muted-foreground">When disabled, employee leaderboard APIs return no names or scores.</p>
 {save.isError&&<p role="alert">{save.error.message}</p>}{save.isSuccess&&<p role="status">Preferences saved.</p>}<Button disabled={save.isPending} type="submit">{save.isPending?'Saving...':'Save preferences'}</Button>
 </form>}</AppLayout>;
}
