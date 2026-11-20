import {useQuery} from '@tanstack/react-query';
export default function WorkspaceBanner(){
  const {data}=useQuery<{name:string;demonstration:boolean}>({queryKey:['/api/workspace'],staleTime:60000});
  return data?.demonstration?<div role="status" className="border-b border-amber-500 bg-amber-50 px-6 py-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"><strong>Sample data · Demonstration workspace</strong> — fictional history for product evaluation. Campaign sending is blocked in this workspace.</div>:null;
}
