import type { Express } from 'express';
import { isAuthenticated,hasOrganization } from '../auth';
import { pool } from '../db';
import { getPrivateObject } from '../services/object-store';
import { z } from 'zod';
import path from 'node:path';

export function registerPrivateAssets(app:Express) {
  app.get('/api/assets/:assetId',isAuthenticated,hasOrganization,async(req,res)=> {
    const parsed=z.string().uuid().safeParse(req.params.assetId);if(!parsed.success)return res.status(400).json({message:'Invalid asset'});
    const {rows:[asset]}=await pool.query('SELECT object_key,mime_type FROM private_assets WHERE id=$1 AND organization_id=$2',[parsed.data,req.user!.organizationId]);
    if(!asset)return res.status(404).json({message:'Asset not found'});
    res.setHeader('Cache-Control','private, max-age=60');res.setHeader('X-Content-Type-Options','nosniff');
    res.type(asset.mime_type).send(await getPrivateObject(asset.object_key));
  });
  // Compatibility for old profile/landing thumbnails: require a tenant-owned reference.
  app.get('/uploads/:filename',isAuthenticated,hasOrganization,async(req,res)=> {
    if(!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp)$/i.test(req.params.filename))return res.sendStatus(404);
    const url='/uploads/'+req.params.filename;
    const result=await pool.query('SELECT id FROM users WHERE organization_id=$1 AND profile_picture=$2 UNION ALL SELECT id FROM landing_pages WHERE organization_id=$1 AND thumbnail=$2 LIMIT 1',[req.user!.organizationId,url]);
    if(!result.rowCount)return res.sendStatus(404);
    res.setHeader('Cache-Control','private, max-age=60');res.sendFile(path.resolve('uploads',req.params.filename));
  });
}
