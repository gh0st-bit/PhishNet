import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export async function sendTransactionalMail(message:Mail.Options) {
  const sink=process.env.MAIL_TRANSPORT==='sink';
  const host=process.env.TRANSACTIONAL_SMTP_HOST||process.env.SMTP_HOST;
  const port=Number(process.env.TRANSACTIONAL_SMTP_PORT||process.env.SMTP_PORT||587);
  const user=process.env.TRANSACTIONAL_SMTP_USERNAME||process.env.SMTP_USERNAME||process.env.SMTP_USER;
  const pass=process.env.TRANSACTIONAL_SMTP_PASSWORD||process.env.SMTP_PASSWORD||process.env.SMTP_PASS;
  const from=process.env.TRANSACTIONAL_FROM_EMAIL||process.env.SMTP_FROM_EMAIL;
  if(!sink&&(!host||!user||!pass||!from))throw Object.assign(new Error('Transactional mail is not configured'),{code:'MAIL_NOT_CONFIGURED'});
  const transport=sink?nodemailer.createTransport({jsonTransport:true}):nodemailer.createTransport({host,port,secure:port===465,
    requireTLS:process.env.NODE_ENV==='production'&&port!==465,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000});
  try {return await transport.sendMail({...message,from:from||'audit@audit.test',disableFileAccess:true,disableUrlAccess:true});}
  finally{transport.close();}
}
