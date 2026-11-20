import {Link,useLocation} from 'wouter';
import {homeFor} from '@shared/access-control';
import WorkspaceBanner from './workspace-banner';
import GlassBackdrop from './glass-backdrop';
import { useTenantPreferences } from '@/hooks/use-tenant-preferences';
import { ReactNode, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import { useAuth } from "@/hooks/use-auth";
import { initSessionManager, cleanupSessionManager } from "@/lib/session-manager";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const { user } = useAuth();
  const [location]=useLocation();
  const {data:preferences}=useTenantPreferences();
  useEffect(()=>{
    if(!preferences)return;document.documentElement.lang=preferences.locale;document.documentElement.dir=preferences.locale.startsWith('ur')?'rtl':'ltr';
    const channels=preferences.accentColor.slice(1).match(/.{2}/g)!.map(v=>parseInt(v,16)/255);
    const luminance=channels.map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const max=Math.max(...channels),min=Math.min(...channels),delta=max-min,l=(max+min)/2;
    const saturation=delta===0?0:delta/(1-Math.abs(2*l-1));let hue=0;
    if(delta){const [r,g,b]=channels;hue=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;hue=(hue*60+360)%360;}
    document.documentElement.style.setProperty('--primary',`${hue} ${saturation*100}% ${l*100}%`);
    document.documentElement.style.setProperty('--primary-foreground',luminance>.179?'0 0% 0%':'0 0% 100%');
    return ()=>{document.documentElement.style.removeProperty('--primary');document.documentElement.style.removeProperty('--primary-foreground');document.documentElement.dir='ltr';document.documentElement.lang='en';};
  },[preferences]);

  useEffect(() => {
    // Initialize session management when app loads
    initSessionManager();
    
    // Cleanup on unmount
    return () => {
      cleanupSessionManager();
    };
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <GlassBackdrop />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">Skip to content</a>
      {/* Floating top bar, then the rail beside the scrolling content (bottom tab bar on phones). */}
      <div className="px-3 pt-3 shrink-0 relative z-20">
        <Header user={user} />
      </div>
      <div className="pn-shell flex flex-1 min-h-0 gap-3 p-3">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-[18px]">
        <WorkspaceBanner />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto bg-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 glass-page-enter">
            <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground print:hidden"><Link href={homeFor(user)} className="hover:underline">Dashboard</Link>{location!==homeFor(user)&&<><span aria-hidden="true"> / </span><span aria-current="page">{title||location.split('/').filter(Boolean).filter(part=>!['admin','org-admin','employee'].includes(part)).map(part=>/^\d+$/.test(part)?'Detail':part.replaceAll('-',' ')).join(' / ')}</span></>}</nav>
            {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
            {children}
          </div>
        </main>
        </div>
      </div>
    </div>
  );
}
