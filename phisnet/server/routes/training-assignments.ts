import type { Express } from 'express';
import { isAuthenticated,isAdminOrOrgAdmin,hasOrganization } from '../auth';
import { pool } from '../db';
import { assignTraining } from '../services/training-automation';
import { z } from 'zod';

const body=z.object({userIds:z.array(z.number().int().positive()).min(1).max(1000),moduleId:z.number().int().positive(),dueDays:z.number().int().min(1).max(365).default(7)});
export function registerTrainingAssignmentRoutes(app:Express) {
  app.get('/api/admin/training-assignments',isAuthenticated,hasOrganization,isAdminOrOrgAdmin,async(req,res)=> {
    try {
      const {rows}=await pool.query(`SELECT a.*,u.email,m.title,p.status FROM training_assignments a JOIN users u ON u.id=a.user_id
        JOIN training_modules m ON m.id=a.module_id JOIN training_progress p ON p.user_id=a.user_id AND p.module_id=a.module_id
        WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 100`,[req.user!.organizationId]);
      res.json({assignments:rows});
    }catch{res.status(500).json({message:'Unable to list assignments'});}
  });
  app.post('/api/admin/training-assignments',isAuthenticated,hasOrganization,isAdminOrOrgAdmin,async(req,res)=> {
    const parsed=body.safeParse(req.body);
    if(!parsed.success) return res.status(400).json({message:'Invalid assignment',errors:parsed.error.issues});
    const client=await pool.connect();
    try {
      await client.query('BEGIN');let assigned=0;
      for(const id of new Set(parsed.data.userIds)) if(await assignTraining(client,req.user!.organizationId,id,parsed.data.moduleId,parsed.data.dueDays,'manual')) assigned++;
      await client.query('COMMIT');res.status(201).json({assigned});
    }catch(error:any){await client.query('ROLLBACK');res.status(error.status||500).json({message:error.status?error.message:'Unable to assign training'});}
    finally{client.release();}
  });
}
