import type { PoolClient } from 'pg';
import { z } from 'zod';

export const audienceRules = z.object({
  department: z.string().trim().min(1).max(100).optional(),
  position: z.string().trim().min(1).max(100).optional(),
  emailDomain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/).optional(),
}).strict().refine(value=>Object.keys(value).length>0,'At least one audience rule is required');

function deduplicate(rows: any[]) {
  const emails=new Set<string>();return rows.filter(row=>{const email=row.email.toLowerCase();if(emails.has(email))return false;emails.add(email);return true;});
}
export async function resolveAudience(client: PoolClient, groupId: number, organizationId: number) {
  const {rows:[group]}=await client.query('SELECT * FROM groups WHERE id=$1 AND organization_id=$2',[groupId,organizationId]);
  if(!group) throw Object.assign(new Error('Target group not found'),{status:400});
  if(!group.filter_rules) return deduplicate((await client.query('SELECT * FROM targets WHERE group_id=$1 AND organization_id=$2 ORDER BY id',[groupId,organizationId])).rows);
  const rules=audienceRules.parse(group.filter_rules);
  return deduplicate((await client.query(`SELECT * FROM targets WHERE organization_id=$1
    AND ($2::text IS NULL OR lower(department)=lower($2))
    AND ($3::text IS NULL OR lower(position)=lower($3))
    AND ($4::text IS NULL OR lower(split_part(email,'@',2))=$4) ORDER BY id`,
  [organizationId,rules.department||null,rules.position||null,rules.emailDomain||null])).rows);
}
