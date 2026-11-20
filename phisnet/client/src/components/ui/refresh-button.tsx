import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button, type ButtonProps} from './button';
import {useToast} from '@/hooks/use-toast';

interface RefreshButtonProps extends Omit<ButtonProps,'onClick'> {
  onRefresh:()=>Promise<unknown>;
}
export function RefreshButton({onRefresh,children='Refresh',disabled,...props}:RefreshButtonProps){
  const [busy,setBusy]=useState(false);
  const {toast}=useToast();
  async function refresh(){
    if(busy)return;
    setBusy(true);
    try{
      const result=await onRefresh();
      for(const item of Array.isArray(result)?result:[result]){
        if(item&&typeof item==='object'&&'error' in item&&item.error)throw item.error;
      }
      toast({title:'Refreshed',description:'The latest saved data is now displayed.'});
    }catch(error){toast({title:'Refresh failed',description:error instanceof Error?error.message:'Please try again.',variant:'destructive'});}
    finally{setBusy(false);}
  }
  return <Button type="button" variant="outline" size="sm" {...props} disabled={disabled||busy} aria-busy={busy} onClick={refresh}><RefreshCw aria-hidden="true" className={`h-4 w-4 mr-2 ${busy?'animate-spin':''}`}/>{children}</Button>;
}
