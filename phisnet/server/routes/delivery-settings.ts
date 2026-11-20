import { storage } from '../storage';
import type { Express } from 'express';
import { isAuthenticated,isAdminOrOrgAdmin,hasOrganization } from '../auth';
import { pool } from '../db';
import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { z } from 'zod';

const domain=z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/);
export function registerDeliverySettings(app:Express) {
  app.get('/api/delivery/capabilities',isAuthenticated,async(_req,res)=>res.json({managedAvailable:process.env.MAIL_TRANSPORT==='sink'||(process.env.MANAGED_SIMULATIONS_APPROVED==='true'&&Boolean(process.env.MANAGED_SENDGRID_API_KEY)),testMode:process.env.MAIL_TRANSPORT==='sink'}));
  const guards=[isAuthenticated,hasOrganization,isAdminOrOrgAdmin];
  app.post('/api/delivery/managed-profile',...guards,async(req,res)=> {
    const parsed=z.object({name:z.string().trim().min(1).max(100),fromName:z.string().trim().min(1).max(100),fromEmail:z.string().email()}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({message:'Profile name and sender details are required'});
    if(process.env.MAIL_TRANSPORT!=='sink' && (process.env.MANAGED_SIMULATIONS_APPROVED!=='true'||!process.env.MANAGED_SENDGRID_API_KEY))return res.status(403).json({message:'Managed delivery has not been configured and approved'});
    const profile=await storage.createSmtpProfile(req.user!.organizationId,{...parsed.data,organizationId:req.user!.organizationId,deliveryMode:'managed_sendgrid',host:'api.sendgrid.com',port:443,username:'platform',password:''});
    const {password:_password,...safe}=profile;res.status(201).json(safe);
  });
  app.get('/api/delivery/domains',...guards,async(req,res)=>{
    const {rows}=await pool.query('SELECT id,domain,challenge,verified_at FROM verified_domains WHERE organization_id=$1 ORDER BY domain',[req.user!.organizationId]);res.json({domains:rows});
  });
  app.post('/api/delivery/domains',...guards,async(req,res)=>{
    const parsed=domain.safeParse(req.body.domain);if(!parsed.success)return res.status(400).json({message:'Enter a valid domain'});
    const challenge='phishnet-verification='+randomBytes(24).toString('hex');
    const {rows:[record]}=await pool.query(`INSERT INTO verified_domains(organization_id,domain,challenge) VALUES($1,$2,$3)
      ON CONFLICT(organization_id,domain) DO UPDATE SET domain=EXCLUDED.domain RETURNING id,domain,challenge,verified_at`,[req.user!.organizationId,parsed.data,challenge]);
    res.status(201).json({...record,recordName:`_phishnet-verification.${record.domain}`,recordType:'TXT'});
  });
  app.post('/api/delivery/domains/:id/verify',...guards,async(req,res)=>{
    const {rows:[record]}=await pool.query('SELECT * FROM verified_domains WHERE id=$1 AND organization_id=$2',[Number(req.params.id),req.user!.organizationId]);
    if(!record)return res.status(404).json({message:'Domain not found'});
    try {
      const records=await resolveTxt(`_phishnet-verification.${record.domain}`);
      if(!records.some(value=>value.join('')===record.challenge))return res.status(400).json({message:'Verification TXT record was not found'});
      await pool.query('UPDATE verified_domains SET verified_at=now() WHERE id=$1',[record.id]);res.json({verified:true});
    }catch{return res.status(400).json({message:'Unable to resolve the verification TXT record'});}
  });
  app.get('/api/delivery/suppressions',...guards,async(req,res)=>{
    const {rows}=await pool.query('SELECT email,reason,created_at FROM delivery_suppressions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user!.organizationId]);res.json({suppressions:rows});
  });
}
