import {useEffect,useState} from 'react';

// Tab-local, user-scoped list preferences. Never use this for credentials or secrets.
export function useSessionFilter<T>(key:string,fallback:T,valid:(value:unknown)=>value is T){
  const [value,setValue]=useState<T>(()=>{
    try {const saved=JSON.parse(sessionStorage.getItem(key)||'null');return valid(saved)?saved:fallback;}catch{return fallback;}
  });
  useEffect(()=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}},[key,value]);
  return [value,setValue] as const;
}
