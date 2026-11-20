import { S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import path from 'node:path';

function localPath(key:string) {
  if(!/^(assets|reports|backups)\/\d+\/[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(key))throw new Error('Invalid object key');
  const root=path.resolve(process.env.UPLOAD_ROOT||'uploads');const target=path.resolve(root,key);
  if(!target.startsWith(root+path.sep))throw new Error('Object key escapes storage root');return target;
}
function s3() {
  if(!process.env.S3_BUCKET)throw new Error('S3_BUCKET is required');
  return new S3Client({region:process.env.S3_REGION||'us-east-1',endpoint:process.env.S3_ENDPOINT||undefined,
    forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true'||Boolean(process.env.S3_ENDPOINT),
    ...(process.env.S3_ACCESS_KEY_ID?{credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY||''}}:{}),
    maxAttempts:3});
}
export async function putPrivateObject(key:string,body:Buffer,mime:string) {
  const target=localPath(key);
  if(process.env.ASSET_STORAGE==='s3') {
    const client=s3();try{await client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:body,ContentType:mime}));}finally{client.destroy();}
  }else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,body,{flag:'wx',mode:0o600});}
}
export async function getPrivateObject(key:string):Promise<Buffer> {
  const target=localPath(key);
  if(process.env.ASSET_STORAGE==='s3') {
    const client=s3();try{const value=await client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));if(!value.Body)throw new Error('Object not found');return Buffer.from(await value.Body.transformToByteArray());}finally{client.destroy();}
  }
  return readFile(target);
}
export async function deletePrivateObject(key:string) {
  const target=localPath(key);
  if(process.env.ASSET_STORAGE==='s3') {
    const client=s3();try{await client.send(new DeleteObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));}finally{client.destroy();}
  }else{try{await unlink(target);}catch(error:any){if(error.code!=='ENOENT')throw error;}}
}
export function imageType(body:Buffer) {
  if(body.length<12)throw Object.assign(new Error('Invalid image'),{status:415});
  if(body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',extension:'png'};
  if(body[0]===255&&body[1]===216&&body[2]===255)return {mime:'image/jpeg',extension:'jpg'};
  if(['GIF87a','GIF89a'].includes(body.subarray(0,6).toString()))return {mime:'image/gif',extension:'gif'};
  if(body.subarray(0,4).toString()==='RIFF'&&body.subarray(8,12).toString()==='WEBP')return {mime:'image/webp',extension:'webp'};
  throw Object.assign(new Error('Only PNG, JPEG, GIF and WebP images are supported'),{status:415});
}
