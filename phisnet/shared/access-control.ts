export interface Identity { isAdmin?: boolean; roles?: string[] }
export type AppRole = 'Admin' | 'OrgAdmin' | 'Manager' | 'User';
export function roleNames(roles:readonly unknown[]|undefined):string[]{return (roles||[]).flatMap(role=>typeof role==='string'?[role]:role&&typeof role==='object'&&'name' in role&&typeof role.name==='string'?[role.name]:[]);}
export function appRole(user: Identity | null | undefined): AppRole {
  if (user?.isAdmin || user?.roles?.includes('Admin')) return 'Admin';
  if (user?.roles?.includes('OrgAdmin')) return 'OrgAdmin';
  if (user?.roles?.includes('Manager')) return 'Manager';
  return 'User';
}
const management = ['dashboard:view', 'dashboard:analytics', 'campaigns:view', 'campaigns:create', 'campaigns:edit', 'campaigns:delete', 'campaigns:launch', 'groups:view', 'groups:create', 'groups:edit', 'groups:delete', 'templates:view', 'templates:create', 'templates:edit', 'templates:delete', 'smtp:view', 'smtp:create', 'smtp:edit', 'smtp:delete', 'reports:view', 'reports:export', 'reports:analytics'];
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  Admin: ['all'],
  OrgAdmin: [...management, 'users:view', 'users:create', 'users:edit', 'users:delete', 'users:manage_roles', 'organization:settings'],
  Manager: ['teams:report','teams:export','teams:remind'],
  User: [],
};
export function can(user: Identity | null | undefined, permission: string): boolean {
  if (!user) return false;
  const permissions = ROLE_PERMISSIONS[appRole(user)];
  return permissions.includes('all') || permissions.includes(permission);
}
export function homeFor(user: Identity | null | undefined): string {
  const role = appRole(user);
  return role === 'Admin' ? '/' : role === 'User' ? '/employee' : role === 'Manager' ? '/manager' : '/org-admin';
}

// Both notification surfaces use the same role-aware, internal destinations.
// Normalize old stored URLs as well as newly generated notifications.
export function notificationDestination(notification: { type?: string; actionUrl?: string | null; metadata?: Record<string, any> }, user: Identity): string {
  const role = appRole(user), employee = role === 'User';
  if(appRole(user)==='Manager')return notification.type==='password_changed'?'/settings':'/manager';
  const root = role === 'Admin' ? '' : '/org-admin';
  const raw = notification.actionUrl || '';
  let path = '';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) path = raw.split('?')[0];
  const meta = notification.metadata || {};
  const query = new URLSearchParams(raw.split('?')[1] || '');
  const id = (value: unknown) => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? String(value) : '';
  if (notification.type === 'article' || /\/articles(?:\/|$)/.test(path)) {
    const article = id(meta.articleId) || id(path.match(/\/articles\/(\d+)/)?.[1]) || id(query.get('preview'));
    if (employee) return article ? `/employee/articles/${article}` : '/employee/articles';
    return role === 'Manager' ? homeFor(user) : '/admin/content/articles' + (article ? `?preview=${article}` : '');
  }
  if (notification.type === 'flashcard' || path.includes('flashcard')) {
    const deck = id(meta.deckId) || id(meta.flashcardDeckId) || id(query.get('deck'));
    if (role === 'Manager') return homeFor(user);
    return (employee ? '/employee/flashcards' : '/admin/content/flashcards') + (deck ? `?deck=${deck}` : '');
  }
  if (/campaign|email_opened|link_clicked|form_submitted/.test(notification.type || '') || /\/campaigns(?:\/|$)/.test(path)) {
    if (employee) return '/employee';
    const campaign = id(meta.campaignId) || id(path.match(/\/campaigns\/(\d+)/)?.[1]) || id(query.get('campaign'));
    return `${root}/campaigns` + (campaign ? `?campaign=${campaign}` : '');
  }
  if(path==='/employee/learning-paths')return employee?path:homeFor(user);
  if (notification.type === 'training' || path.includes('/training')) return employee ? '/employee/training' : role === 'Manager' ? homeFor(user) : '/org-admin/training-assignments';
  if (path.includes('/quizzes')) return employee ? '/employee/quizzes' : role === 'Manager' ? homeFor(user) : '/admin/quizzes';
  if (path.includes('enroll') || notification.type === 'invite_accepted') return employee || role === 'Manager' ? homeFor(user) : `${root}/enrollment`;
  if (path.includes('reports') || /report/.test(notification.type || '')) return employee ? homeFor(user) : `${root}/reports`;
  if (path.includes('threat')) return role === 'Admin' ? '/threat-landscape' : homeFor(user);
  if (path.startsWith('/settings') || /security|password|login/.test(notification.type || '')) return '/settings';
  if (path === '/notifications') return path;
  return homeFor(user);
}
