import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Redirect, Route } from 'wouter';
import { appRole, homeFor } from '@shared/access-control';

export function ProtectedRoute({ path, component: Component }: Readonly<{ path: string; component: React.ComponentType }>) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Route path={path}><div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Route>;
  if (!user) return <Route path={path}><Redirect to={path==='/employee/report'?'/auth?next='+encodeURIComponent(window.location.pathname+window.location.search):path.startsWith('/org-admin') ? '/auth?mode=org-admin' : '/auth'} /></Route>;
  const role = appRole(user);
  const common = ['/settings', '/profile', '/notifications', '/local-inbox', '/walkthrough'].includes(path);
  const content = path.startsWith('/admin/content/') || ['/admin/training', '/admin/quizzes'].includes(path);
  const managerPages = ['/manager'];
  const allowed = common || (role === 'Admin' ? !path.startsWith('/employee') && path !== '/manager'
    : role === 'OrgAdmin' ? path.startsWith('/org-admin') || content
    : role === 'Manager' ? managerPages.includes(path)
    : path.startsWith('/employee'));
  return <Route path={path}>{allowed ? <Component /> : <Redirect to={homeFor(user)} />}</Route>;
}
