import 'dotenv/config';
import { db } from '../db';
import { users, rolesSchema, userRolesSchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function checkUserRoles() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: tsx server/scripts/check-user-roles.ts <email>');
    process.exit(1);
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log('\n👤 User Info:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.firstName} ${user.lastName}`);
    console.log(`  isAdmin: ${user.isAdmin}`);
    console.log(`  organizationId: ${user.organizationId}`);

    const userRoles = await db
      .select({ roleName: rolesSchema.name })
      .from(userRolesSchema)
      .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
      .where(eq(userRolesSchema.userId, user.id));

    console.log('\n🎭 Assigned Roles:');
    if (userRoles.length === 0) {
      console.log('  ⚠️  NO ROLES ASSIGNED');
    } else {
      userRoles.forEach(r => console.log(`  - ${r.roleName}`));
    }

    console.log('\n✅ Expected redirect:');
    const roles = userRoles.map(r => r.roleName);
    const isGlobalAdmin = user.isAdmin || roles.includes('Admin');
    const isOrgAdmin = roles.includes('OrgAdmin') && !isGlobalAdmin;
    const isEmployee = roles.includes('User') && !user.isAdmin;

    if (isGlobalAdmin) {
      console.log('  → / (Admin Dashboard)');
    } else if (isOrgAdmin) {
      console.log('  → /org-admin (Org Admin Portal)');
    } else if (isEmployee) {
      console.log('  → /employee (Employee Portal)');
    } else {
      console.log('  ⚠️  AMBIGUOUS - no matching role pattern!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserRoles();
