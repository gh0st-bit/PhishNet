import { useEffect,useState,type ReactNode } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useGroups,useSmtpProfiles,useTemplates,useLandingPages } from '@/hooks/useApi';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { insertCampaignSchema } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const steps=['Audience','Message','Delivery','Training','Review'];
const initial={name:'',targetGroupId:'',smtpProfileId:'',emailTemplateId:'',landingPageId:'',scheduledAt:'',endDate:'',
  recurrenceDays:'',recurrenceUntil:'',trainingModuleId:'',passwordTrainingModuleId:'',trainingDueDays:'7',templatePool:[] as number[],
  sendTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,sendWindowStart:'',sendWindowEnd:''};
function Field({label,children}:{label:string;children:ReactNode}) {return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span>{children}</label>;}
const selectClass='w-full rounded-md border bg-background p-2 text-foreground';
const minute=(value:string)=>value?Number(value.split(':')[0])*60+Number(value.split(':')[1]):undefined;

export default function CampaignWizard({onClose}:{onClose:()=>void}) {
  const {user}=useAuth();const {toast}=useToast();const cache=useQueryClient();
  const [values,setValues]=useState(initial);const [step,setStep]=useState(0);const [error,setError]=useState('');
  const draftKey=`phishnet.campaign-draft.${user?.organizationId}.${user?.id}`;
  useEffect(()=>{try{const draft=sessionStorage.getItem(draftKey);if(draft)setValues({...initial,...JSON.parse(draft)});}catch{sessionStorage.removeItem(draftKey);}},[draftKey]);
  useEffect(()=>{sessionStorage.setItem(draftKey,JSON.stringify(values));},[draftKey,values]);
  const {data:groups=[]}=useGroups();const {data:profiles=[]}=useSmtpProfiles();const {data:pages=[]}=useLandingPages();
  const {data:templateData}=useTemplates();
  const templates=Array.isArray(templateData)?templateData:templateData?.templates||[];
  const {data:training}=useQuery<{modules:{id:number;title:string}[]}>({queryKey:['/api/admin/training-modules'],queryFn:async()=>(await apiRequest('GET','/api/admin/training-modules')).json()});
  const modules=training?.modules||[];
  const change=(name:keyof typeof initial,value:string)=>setValues(previous=>({...previous,[name]:value}));
  const payload=()=>({name:values.name.trim(),targetGroupId:Number(values.targetGroupId),smtpProfileId:Number(values.smtpProfileId),emailTemplateId:Number(values.emailTemplateId),landingPageId:Number(values.landingPageId),
    ...(values.scheduledAt?{scheduledAt:new Date(values.scheduledAt).toISOString()}:{}),...(values.endDate?{endDate:new Date(values.endDate).toISOString()}:{}),
    recurrenceDays:values.recurrenceDays?Number(values.recurrenceDays):null,recurrenceUntil:values.recurrenceUntil?new Date(values.recurrenceUntil).toISOString():null,
    trainingModuleId:values.trainingModuleId?Number(values.trainingModuleId):null,passwordTrainingModuleId:values.passwordTrainingModuleId?Number(values.passwordTrainingModuleId):null,
    trainingDueDays:Number(values.trainingDueDays),templatePool:values.templatePool,sendTimezone:values.sendTimezone,
    sendWindowStart:minute(values.sendWindowStart),sendWindowEnd:minute(values.sendWindowEnd)});
  const [preflight,setPreflight]=useState<{recipients:number;checks:{name:string;passed:boolean}[]}|null>(null);
  const check=useMutation({mutationFn:async()=>(await apiRequest('POST','/api/campaigns/preflight',payload())).json(),onSuccess:setPreflight,onError:(failure:Error)=>setError(failure.message)});
  const save=useMutation({mutationFn:async()=>{const body=insertCampaignSchema.parse(payload());return (await apiRequest('POST','/api/campaigns',body)).json();},
    onSuccess:()=>{sessionStorage.removeItem(draftKey);void cache.invalidateQueries({queryKey:['/api/campaigns']});toast({title:'Draft saved',description:'Review your campaign and use Launch when you are ready.'});onClose();},
    onError:(failure:Error)=>setError(failure.message)});
  function next() {
    if(step===0 && (!values.name.trim()||!values.targetGroupId)){setError('Enter a campaign name and select an audience.');return;}
    if(step===1 && (!values.emailTemplateId||!values.landingPageId)){setError('Select an email template and landing page.');return;}
    if(step===2 && (!values.smtpProfileId||!values.sendTimezone)){setError('Select a sending profile and timezone.');return;}
    setError('');setStep(previous=>Math.min(4,previous+1));
  }
  const choose=(label:string,name:keyof typeof initial,options:{id:number;name?:string;title?:string}[],optional=false)=>
    <Field label={label}><select className={selectClass} value={String(values[name])} onChange={event=>change(name,event.target.value)}><option value="">{optional?'None':'Select an option'}</option>{options.map(option=><option key={option.id} value={option.id}>{option.name||option.title}</option>)}</select></Field>;
  const selectedTemplate=templates.find(item=>item.id===Number(values.emailTemplateId));
  return <div className="space-y-6">
    <ol aria-label="Campaign setup steps" className="flex flex-wrap gap-2 text-sm">{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined} className={`rounded px-3 py-2 ${step===index?'bg-primary text-primary-foreground':'bg-muted'}`}>{index+1}. {label}</li>)}</ol>
    <p className="text-sm text-muted-foreground">Your draft is saved in this tab as you work.</p>
    {error&&<p role="alert" className="rounded border border-destructive p-3 text-destructive">{error}</p>}
    <section className="space-y-4" aria-label={steps[step]}>
      {step===0&&<><Field label="Campaign Name"><Input value={values.name} onChange={event=>change('name',event.target.value)} maxLength={200}/></Field>{choose('Audience','targetGroupId',groups)}<p className="text-sm text-muted-foreground">Dynamic audiences are evaluated when this campaign launches. Recipient snapshots remain stable after launch.</p></>}
      {step===1&&<>{choose('Email template','emailTemplateId',templates)}{choose('Landing page','landingPageId',pages)}<fieldset className="space-y-2"><legend>Additional templates for rotation</legend>{templates.filter(item=>item.id!==Number(values.emailTemplateId)).map(item=><label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.templatePool.includes(item.id)} onChange={event=>setValues(previous=>({...previous,templatePool:event.target.checked?[...previous.templatePool,item.id]:previous.templatePool.filter(id=>id!==item.id)}))}/>{item.name}</label>)}</fieldset>{selectedTemplate&&<iframe title="Email preview" sandbox="" className="h-52 w-full rounded border bg-white" srcDoc={selectedTemplate.htmlContent || (selectedTemplate as any).html_content || '<p>No preview available</p>'}/>}</>}
      {step===2&&<>{choose('Sending profile','smtpProfileId',profiles)}<div className="grid gap-4 sm:grid-cols-2"><Field label="Scheduled launch (optional)"><Input type="datetime-local" value={values.scheduledAt} onChange={event=>change('scheduledAt',event.target.value)}/></Field><Field label="Observation end (optional)"><Input type="datetime-local" value={values.endDate} onChange={event=>change('endDate',event.target.value)}/></Field><Field label="Repeat every (days, optional)"><Input type="number" min={1} max={365} value={values.recurrenceDays} onChange={event=>change('recurrenceDays',event.target.value)}/></Field><Field label="Repeat until (optional)"><Input type="datetime-local" value={values.recurrenceUntil} onChange={event=>change('recurrenceUntil',event.target.value)}/></Field><Field label="Sending timezone"><Input value={values.sendTimezone} onChange={event=>change('sendTimezone',event.target.value)}/></Field><div/><Field label="Sending window starts (optional)"><Input type="time" value={values.sendWindowStart} onChange={event=>change('sendWindowStart',event.target.value)}/></Field><Field label="Sending window ends (optional)"><Input type="time" value={values.sendWindowEnd} onChange={event=>change('sendWindowEnd',event.target.value)}/></Field></div><p className="text-sm text-muted-foreground">Launch confirms the schedule. Repeats use the same UTC interval; sending windows follow the selected timezone.</p></>}
      {step===3&&<>{choose('Training after a click or submission','trainingModuleId',modules,true)}{choose('Training for weak or breached password findings','passwordTrainingModuleId',modules,true)}<Field label="Training due within (days)"><Input type="number" min={1} max={365} value={values.trainingDueDays} onChange={event=>change('trainingDueDays',event.target.value)}/></Field><p className="text-sm text-muted-foreground">Training is assigned to an active employee whose email matches the simulation recipient. Employees receive an in-app notification and reminders.</p></>}
      {step===4&&<><Button variant="outline" disabled={check.isPending} onClick={()=>check.mutate()}>Run preflight checks</Button>{preflight&&<div role="status"><p>{preflight.recipients} recipients</p><ul>{preflight.checks.map(item=><li key={item.name}>{item.passed?'Pass':'Needs attention'}: {item.name}</li>)}</ul></div>}<h3 className="font-semibold">Review your campaign</h3><dl className="grid grid-cols-2 gap-3 text-sm"><dt>Name</dt><dd>{values.name}</dd><dt>Audience</dt><dd>{groups.find(item=>item.id===Number(values.targetGroupId))?.name}</dd><dt>Template</dt><dd>{selectedTemplate?.name}</dd><dt>Sending profile</dt><dd>{profiles.find(item=>item.id===Number(values.smtpProfileId))?.name}</dd><dt>Launch</dt><dd>{values.scheduledAt||'When you explicitly launch'}</dd><dt>Recurrence</dt><dd>{values.recurrenceDays?`Every ${values.recurrenceDays} days`:'One time'}</dd></dl><p className="rounded bg-muted p-3 text-sm">Saving creates a draft. Emails are queued only after you confirm Launch from the campaign list.</p></>}
    </section>
    <div className="flex justify-between gap-3"><Button variant="outline" onClick={step?()=>setStep(step-1):onClose}>{step?'Back':'Cancel'}</Button>{step<4?<Button onClick={next}>Continue</Button>:<Button disabled={save.isPending} onClick={()=>save.mutate()}>{save.isPending?'Saving...':'Save draft'}</Button>}</div>
  </div>;
}
