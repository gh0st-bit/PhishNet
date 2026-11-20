import type { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  Mail,
  FolderOpen,
  Users,
  Bell,
  Layout,
  Send,
  BarChart,
  Shield,
  Settings,
  AlertTriangle,
  Search,
  Calendar,
  FileText,
  BookOpen,
  HelpCircle,
  Award,
  GraduationCap,
  Trophy,
  UserPlus,
  Layers,
  Building2,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTenantPreferences } from "@/hooks/use-tenant-preferences";
import { appRole } from "@shared/access-control";

/**
 * Single source of navigation for the rail, its flyouts and the Ctrl+K palette.
 * The item list and role filtering below are moved unchanged from the previous
 * sidebar, so every role keeps exactly the same pages and restrictions.
 */
export interface NavigationItem {
  name: string;
  href?: string;
  icon: ReactNode;
  children?: NavigationItem[];
  adminOnly?: boolean;
  orgAdminOnly?: boolean;
  userOnly?: boolean;
}

export interface NavSection {
  /** Visible section name (also the rail button label). */
  name: string;
  icon: ReactNode;
  /** Leaf links, already filtered for the signed-in role. */
  items: { name: string; href: string; icon: ReactNode }[];
}

// Employee links were a flat list; they are grouped only so the rail and the phone
// tab bar stay usable. Any link not listed here falls back to "Home", so none is lost.
const EMPLOYEE_GROUPS: { name: string; icon: ReactNode; members: string[] }[] = [
  { name: "Home", icon: <LayoutGrid className="h-5 w-5" />, members: ["Dashboard", "My inbox", "Report message", "Notifications"] },
  { name: "Learning", icon: <GraduationCap className="h-5 w-5" />, members: ["Learning paths", "Training", "Quizzes", "Articles", "Flashcards"] },
  { name: "Progress", icon: <Trophy className="h-5 w-5" />, members: ["Badges", "Leaderboard", "My profile"] },
  { name: "Settings", icon: <Settings className="h-5 w-5" />, members: ["Settings"] },
];

export function useNavigation(): { sections: NavSection[]; location: string } {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: preferences } = useTenantPreferences();
  const role = appRole(user);
  const isAdmin = role === 'Admin';
  const isOrgAdmin = role === 'OrgAdmin' || role === 'Manager';
  // Treat org admins as distinct from employees so they cannot see
  // or navigate to employee-only pages.
  const isEmployee = role === 'User';

  const navigation: NavigationItem[] = [
    {name:'Setup & teams',href:'/org-admin/setup',icon:<Users className="h-5 w-5"/>,orgAdminOnly:true},
    {name:'Setup & teams',href:'/org-admin/setup',icon:<Users className="h-5 w-5"/>,adminOnly:true},
    {name:'Local inbox',href:'/local-inbox',icon:<Mail className="h-5 w-5"/>,adminOnly:true},
    {name:'Local inbox',href:'/local-inbox',icon:<Mail className="h-5 w-5"/>,orgAdminOnly:true},
    {name:'My inbox',href:'/employee/inbox',icon:<Mail className="h-5 w-5"/>,userOnly:true},
    {name:'Learning paths',href:'/employee/learning-paths',icon:<BookOpen className="h-5 w-5"/>,userOnly:true},
    {name:'Report message',href:'/employee/report',icon:<Shield className="h-5 w-5"/>,userOnly:true},
    { name: 'Dashboard', href: '/employee', icon: <BarChart3 className="h-5 w-5" />, userOnly: true },
    { name: 'Content', icon: <FolderOpen className="h-5 w-5" />, orgAdminOnly: true, children: [
      { name: 'Articles', href: '/admin/content/articles', icon: <FileText className="h-4 w-4" /> },
      { name: 'Videos', href: '/admin/content/videos', icon: <BookOpen className="h-4 w-4" /> },
      { name: 'Flashcards', href: '/admin/content/flashcards', icon: <Layers className="h-4 w-4" /> },
      { name: 'MCQs', href: '/admin/content/mcqs', icon: <HelpCircle className="h-4 w-4" /> },
    ] },
    {name:'Email delivery',href:'/org-admin/delivery',icon:<Send className="h-5 w-5"/>,orgAdminOnly:true},
    {name:'Training assignments',href:'/org-admin/training-assignments',icon:<GraduationCap className="h-5 w-5"/>,orgAdminOnly:true},
    {name:'Email delivery',href:'/org-admin/delivery',icon:<Send className="h-5 w-5"/>,adminOnly:true},
    {name:'Training assignments',href:'/org-admin/training-assignments',icon:<GraduationCap className="h-5 w-5"/>,adminOnly:true},
    {name:"Operations",href:"/admin/operations",icon:<BarChart3 className="h-5 w-5"/>,adminOnly:true},
    {name:"Organization preferences",href:"/org-admin/settings",icon:<Settings className="h-5 w-5"/>,orgAdminOnly:true},
    {name:"Organization preferences",href:"/org-admin/settings",icon:<Settings className="h-5 w-5"/>,adminOnly:true},
    // Admin-only navigation
    { 
      name: "Dashboard", 
      href: "/", 
      icon: <BarChart3 className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Campaigns", 
      href: "/campaigns", 
      icon: <Mail className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Credential Captures", 
      href: "/admin/credential-captures", 
      icon: <Shield className="h-5 w-5" />,
      adminOnly: true
    },
    // ...other admin items...
    { 
      name: "Enrollment", 
      href: "/enrollment", 
      icon: <UserPlus className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Manage Organizations", 
      href: "/organization-management", 
      icon: <Building2 className="h-5 w-5" />,
      adminOnly: true
    },
    {
      name: "Content",
      icon: <FolderOpen className="h-5 w-5" />,
      adminOnly: true,
      children: [
        { name: "Articles", href: "/admin/content/articles", icon: <FileText className="h-4 w-4" /> },
        { name: "Videos", href: "/admin/content/videos", icon: <FolderOpen className="h-4 w-4" /> },
        { name: "Flashcards", href: "/admin/content/flashcards", icon: <BookOpen className="h-4 w-4" /> },
        { name: "MCQs", href: "/admin/content/mcqs", icon: <HelpCircle className="h-4 w-4" /> },
      ]
    },
    { 
      name: "Reconnaissance", 
      href: "/reconnaissance", 
      icon: <Search className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Templates", 
      href: "/templates", 
      icon: <FolderOpen className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Groups", 
      href: "/groups", 
      icon: <Users className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Landing Pages", 
      href: "/landing-pages", 
      icon: <Layout className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "SMTP Profiles", 
      href: "/smtp-profiles", 
      icon: <Send className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Threat Landscape", 
      href: "/threat-landscape", 
      icon: <AlertTriangle className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Reports", 
      href: "/reports", 
      icon: <BarChart className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Report Schedules", 
      href: "/report-schedules", 
      icon: <Calendar className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Audit Logs", 
      href: "/audit-logs", 
      icon: <FileText className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Users", 
      href: "/users", 
      icon: <Shield className="h-5 w-5" />,
      adminOnly: true
    },
    
    // Org Admin navigation (limited to their organization)
    { 
      name: "Dashboard", 
      href: "/org-admin", 
      icon: <BarChart3 className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Campaigns", 
      href: "/org-admin/campaigns", 
      icon: <Mail className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Templates", 
      href: "/org-admin/templates", 
      icon: <FolderOpen className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Landing Pages", 
      href: "/org-admin/landing-pages", 
      icon: <Layout className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "SMTP Profiles", 
      href: "/org-admin/smtp-profiles", 
      icon: <Send className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Enrollment", 
      href: "/org-admin/enrollment", 
      icon: <UserPlus className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Groups", 
      href: "/org-admin/groups", 
      icon: <Users className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Users", 
      href: "/org-admin/users", 
      icon: <Shield className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Reports", 
      href: "/org-admin/reports", 
      icon: <BarChart className="h-5 w-5" />,
      orgAdminOnly: true
    },
    
    {name:'Training',href:'/employee/training',icon:<BookOpen className="h-5 w-5"/>,userOnly:true},
    {name:'Quizzes',href:'/employee/quizzes',icon:<HelpCircle className="h-5 w-5"/>,userOnly:true},
    {name:'Articles',href:'/employee/articles',icon:<FileText className="h-5 w-5"/>,userOnly:true},
    {name:'Flashcards',href:'/employee/flashcards',icon:<Layers className="h-5 w-5"/>,userOnly:true},
    {name:'Badges',href:'/employee/badges',icon:<Award className="h-5 w-5"/>,userOnly:true},
    {name:'Leaderboard',href:'/employee/leaderboard',icon:<Trophy className="h-5 w-5"/>,userOnly:true},
    {name:'My profile',href:'/employee/profile',icon:<Users className="h-5 w-5"/>,userOnly:true},
    {name:'Notifications',href:'/notifications',icon:<Bell className="h-5 w-5"/>},
    // Common settings
    { 
      name: "Settings", 
      href: "/settings", 
      icon: <Settings className="h-5 w-5" /> 
    },
  ];

  const allowedItems=navigation.filter(item=>!(item.adminOnly&&!isAdmin)&&!(item.orgAdminOnly&&!isOrgAdmin)&&!(item.userOnly&&!isEmployee)&&(role!=='Manager'||['Dashboard','Notifications','Settings'].includes(item.name)));
  let visibleNavigation:NavigationItem[]=allowedItems;
  if(role==='Admin'||role==='OrgAdmin') {
    const take=(names:string[])=>allowedItems.filter(item=>names.includes(item.name)).flatMap(item=>item.children?item.children:[item]);
    const categories=[
      {name:'People',icon:<Users className="h-5 w-5"/>,children:take(['Setup & teams','Enrollment','Groups','Users'])},
      {name:'Campaigns',icon:<Mail className="h-5 w-5"/>,children:take(['Campaigns','Templates','Landing Pages','Local inbox','Credential Captures'])},
      {name:'Learning',icon:<GraduationCap className="h-5 w-5"/>,children:[{name:'Content library',href:'/org-admin/content-library',icon:<BookOpen className="h-4 w-4"/>},{name:'Lessons',href:'/admin/training',icon:<GraduationCap className="h-4 w-4"/>},{name:'Assessments',href:'/admin/quizzes',icon:<HelpCircle className="h-4 w-4"/>},...(isAdmin?[{name:'Achievements',href:'/admin/badges',icon:<Award className="h-4 w-4"/>}]:[]),...take(['Content','Training assignments'])]},
      {name:'Reports',icon:<BarChart className="h-5 w-5"/>,children:take(['Reports','Report Schedules'])},
      {name:'Settings',icon:<Settings className="h-5 w-5"/>,children:take(['Settings','Organization preferences','Email delivery','SMTP Profiles'])},
      {name:'Platform operations',icon:<Shield className="h-5 w-5"/>,children:take(['Operations','Audit Logs','Reconnaissance','Threat Landscape','Organizations','Organization','Manage Organizations'])},
    ];
    const groupedNames=new Set(categories.flatMap(c=>c.children.map(child=>child.name)));
    visibleNavigation=[...allowedItems.filter(item=>item.name==='Dashboard'),{name:'Product walkthrough',href:'/walkthrough',icon:<BookOpen className="h-5 w-5"/>},...categories.filter(c=>c.children.length),...allowedItems.filter(item=>item.name!=='Dashboard'&&!item.children&&!groupedNames.has(item.name))];
  }

  // The same visibility rules the previous sidebar applied while rendering.
  const allowed = (item: NavigationItem) =>
    !(item.name === 'Leaderboard' && !preferences?.leaderboardEnabled) &&
    !(item.adminOnly && !isAdmin) && !(item.orgAdminOnly && !isOrgAdmin) && !(item.userOnly && !isEmployee) &&
    !(role === 'Manager' && !['Dashboard', 'Notifications', 'Settings'].includes(item.name));
  const leaf = (item: NavigationItem) => ({
    name: item.name,
    icon: item.icon,
    href: role === 'Manager' && item.href === '/org-admin' ? '/manager' : item.href!,
  });
  const shown = [...visibleNavigation]
    .sort((a, b) => Number(b.name === 'Dashboard') - Number(a.name === 'Dashboard'))
    .filter(item => item.children ? true : allowed(item));
  const singles = shown.filter(item => !item.children && item.href).map(leaf);
  const categories = shown
    .filter(item => item.children?.length)
    .map(item => ({
      name: item.name,
      icon: item.icon,
      items: item.children!.filter(child => !(child.adminOnly && !isAdmin) && !(child.orgAdminOnly && !isOrgAdmin) && !(child.userOnly && !isEmployee) && child.href).map(leaf),
    }))
    .filter(section => section.items.length);

  let sections: NavSection[];
  if (role === 'Admin' || role === 'OrgAdmin') {
    sections = [{ name: 'Home', icon: <LayoutGrid className="h-5 w-5" />, items: singles }, ...categories];
  } else if (role === 'User') {
    const placed = new Set<string>();
    sections = EMPLOYEE_GROUPS.map(group => {
      const items = singles.filter(item => group.members.includes(item.name));
      items.forEach(item => placed.add(item.name));
      return { name: group.name, icon: group.icon, items };
    });
    const leftovers = singles.filter(item => !placed.has(item.name));
    sections[0].items.push(...leftovers);
  } else {
    // Few links (e.g. managers): each is its own rail button.
    sections = singles.map(item => ({ name: item.name, icon: item.icon, items: [item] }));
  }
  return { sections: sections.filter(section => section.items.length), location };
}
