import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
export interface TenantPreferences {leaderboardEnabled?:boolean;brandName:string;locale:string;timezone:string;accentColor:string;captureRetentionDays:number;dataRetentionDays:number}
const translations:Record<string,Record<string,string>>={
 fr:{Dashboard:'Tableau de bord',Campaigns:'Campagnes',Groups:'Groupes',Reports:'Rapports',Settings:'Paramètres',Profile:'Profil',Organization:'Organisation',Users:'Utilisateurs',Notifications:'Notifications','Email delivery':'Envoi des e-mails','Training assignments':'Formations assignées'},
 es:{Dashboard:'Panel',Campaigns:'Campañas',Groups:'Grupos',Reports:'Informes',Settings:'Configuración',Profile:'Perfil',Organization:'Organización',Users:'Usuarios',Notifications:'Notificaciones','Email delivery':'Envío de correo','Training assignments':'Formación asignada'},
 ur:{Dashboard:'ڈیش بورڈ',Campaigns:'مہمات',Groups:'گروپس',Reports:'رپورٹس',Settings:'ترتیبات',Profile:'پروفائل',Organization:'ادارہ',Users:'صارفین',Notifications:'اطلاعات','Email delivery':'ای میل کی ترسیل','Training assignments':'تفویض کردہ تربیت'}
};
export function useTenantPreferences(){
 const {user}=useAuth();const query=useQuery<TenantPreferences>({queryKey:['/api/organization/preferences'],enabled:Boolean(user),staleTime:300000});
 const locale=query.data?.locale||'en-US';
 return {...query,t:(text:string)=>translations[locale.split('-')[0]]?.[text]||text};
}
