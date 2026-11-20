import AppLayout from '@/components/layout/app-layout';
import { useQuery } from '@tanstack/react-query';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
interface Status {dispatch:{queued:number;failed:number;ambiguous:number;oldest_queue_seconds:number};workers:{active:number};reports:{queued:number;attention:number};memoryBytes:number;uptimeSeconds:number}
export default function OperationsPage(){
 const {data,isLoading,error}=useQuery<Status>({queryKey:['/api/admin/operations'],refetchInterval:15000});
 return <AppLayout title="Operations"><p className="mb-4 text-muted-foreground">Live worker health and delivery issues. Refreshes every 15 seconds.</p>{isLoading?<p role="status">Loading operations...</p>:error?<p role="alert">Operations could not be loaded. Check your permissions and retry.</p>:data&&<>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['Active workers',data.workers.active],['Queued emails',data.dispatch.queued],['Oldest queued (seconds)',Math.round(data.dispatch.oldest_queue_seconds)],['Delivery needs review',data.dispatch.ambiguous],['Failed delivery',data.dispatch.failed],['Reports need review',data.reports.attention]].map(([label,value])=><Card key={label}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{value}</CardContent></Card>)}</div>
 {data.workers.active===0&&<p role="alert" className="mt-4 text-destructive">No worker has reported in the past 90 seconds. Start or restart a worker before launching campaigns.</p>}
 <p className="mt-6 text-sm text-muted-foreground">Messages with uncertain acceptance require review on the campaign delivery screen. Verify provider records before retrying to avoid duplicates.</p></>}</AppLayout>;
}
