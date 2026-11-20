import type {Express} from 'express';
import {pool} from '../db';
import {isAuthenticated,hasOrganization,isAdminOrOrgAdmin} from '../auth';
import {z} from 'zod';
const entities=['training_modules','articles','quizzes','flashcard_decks','email_templates','landing_pages'] as const;
const entity=z.enum(entities);
export function registerContentLibrary(app:Express){
  app.use('/api/content-library',isAuthenticated,hasOrganization,isAdminOrOrgAdmin);
  app.get('/api/content-library',async(req,res)=>{
    const type=entity.parse(req.query.type||'training_modules'),search=z.string().max(100).parse(req.query.search||''),archived=req.query.archived==='true';
    const title=['email_templates','landing_pages'].includes(type)?'name':'title';
    const {rows}=await pool.query(`SELECT id,${title} AS title,archived_at FROM ${type} WHERE organization_id=$1 AND (archived_at IS NOT NULL)=$2 AND ${title} ILIKE $3 ORDER BY ${title},id LIMIT 100`,[req.user!.organizationId,archived,'%'+search+'%']);
    res.json({items:rows,type,limit:100});
  });
  app.get('/api/content-library/:type/:id',async(req,res)=>{
    const type=entity.parse(req.params.type),id=z.coerce.number().int().positive().parse(req.params.id);
    const {rows:[item]}=await pool.query(`SELECT * FROM ${type} WHERE id=$1 AND organization_id=$2`,[id,req.user!.organizationId]);
    if(!item)return res.status(404).json({message:'Content not found'});
    // Content is shown in a sandboxed preview. No SMTP secrets or answer keys are returned.
    const preview=type==='quizzes'?item.description||'Assessment content; open the editor to review questions.':type==='training_modules'?item.transcript||item.description:type==='articles'?item.content:type==='flashcard_decks'?item.description:item.html_content;
    res.json({id:item.id,title:item.title||item.name,preview:preview||'No preview content available.',html:['articles','email_templates','landing_pages'].includes(type)});
  });
  app.post('/api/content-library/:type/:id/:action',async(req,res)=>{
    const type=entity.parse(req.params.type),id=z.coerce.number().int().positive().parse(req.params.id),action=z.enum(['archive','restore']).parse(req.params.action);
    const {rows:[item]}=await pool.query(`UPDATE ${type} SET archived_at=${action==='archive'?'now()':'NULL'} WHERE id=$1 AND organization_id=$2 RETURNING id,archived_at`,[id,req.user!.organizationId]);
    if(!item)return res.status(404).json({message:'Content not found'});
    res.json({item,message:action==='archive'?'Archived. Existing frozen assignments remain available.':'Restored. Review before assigning or launching.'});
  });
}
