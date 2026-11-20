import AppLayout from '@/components/layout/app-layout';
import {useAuth} from '@/hooks/use-auth';
import {appRole} from '@shared/access-control';
import {Link} from 'wouter';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {useQuery} from '@tanstack/react-query';
export default function DemonstrationPage(){
  const {user}=useAuth(),role=appRole(user),base=role==='Admin'?'':'/org-admin';
  const workspace=useQuery<{demonstration:boolean}>({queryKey:['/api/workspace']});
  if(role!=='Admin'&&role!=='OrgAdmin')return <AppLayout><h1 className="text-2xl font-bold">Product walkthrough</h1><p>Use your dashboard to review the learning and reporting available to your role.</p><Link href={role==='Manager'?'/manager':'/employee'}>Open my dashboard</Link></AppLayout>;
  return <AppLayout title="Product walkthrough"><p className="mb-6 text-muted-foreground">Explore the workflow from organization outcomes to employee learning and team follow-up. This walkthrough never sends email.</p>
    {!workspace.data?.demonstration&&<Card className="mb-6 p-5"><h2 className="font-semibold">Use a separate sample workspace</h2><p>Sign in with the demonstration accounts prepared by your local operator. Your current organization is not replaced or populated with fictional history.</p></Card>}
    <ol className="grid gap-4 md:grid-cols-2">{[
      ['1. Organization outcomes','Review accepted messages, reporting trends, learning coverage, and the sample-data label.',`${base||'/'}`],
      ['2. Campaign evidence','Open a completed sample campaign and inspect its recipient outcomes.',`${base}/campaigns`],
      ['3. Employee learning','Sign out, then sign in with the sample employee account. Continue the assigned path and inspect earned achievements.','/settings'],
      ['4. Manager follow-up','Sign out, then use the sample manager account. Confirm that only its assigned team is visible.','/settings'],
      ['5. Executive summary','Return to the organization account. Print the overview or export the exact filtered figures.',`${base||'/'}?summary=1`],
      ['6. Integration readiness','Review configured connections and the verification work still needed.','/org-admin/setup'],
    ].map(([title,description,url])=><li key={title}><Card className="h-full p-5 space-y-3"><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p><Button asChild variant="outline"><Link href={url}>Open step</Link></Button></Card></li>)}</ol>
    <Card className="mt-6 p-5"><h2 className="font-semibold">What the demonstration establishes</h2><p className="mt-2 text-sm">Persisted workflows, role boundaries, and reproducible report calculations. Sample history does not establish customer adoption, effectiveness, revenue, or production capacity.</p></Card>
  </AppLayout>;
}
