import type { Express,Router,Request,Response,NextFunction } from 'express';

const wrapped=new WeakSet<object>();
export function reliableRoutes<T extends Express|Router>(target:T):T {
  if(wrapped.has(target))return target;
  wrapped.add(target);
  const decorate=(handler:any):any=> {
    if(Array.isArray(handler))return handler.map(decorate);
    if(typeof handler!=='function'||handler.length===4)return handler;
    return function(req:Request,res:Response,next:NextFunction) {
      try {const result=handler(req,res,next);if(result?.then)void result.catch(next);}
      catch(error){next(error);}
    };
  };
  for(const method of ['get','post','put','patch','delete','use'] as const) {
    const original=(target as any)[method].bind(target);
    (target as any)[method]=(...args:any[])=>original(...args.map(argument=>typeof argument==='function'||Array.isArray(argument)?decorate(argument):argument));
  }
  for(const name of ['id','userId','campaignId','targetId','groupId','orgId','captureId','templateId','moduleId','quizId','deckId']) {
    target.param(name,(req,res,next,value)=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0?next():res.status(400).json({message:`Invalid ${name}`}));
  }
  return target;
}
