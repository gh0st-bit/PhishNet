import 'dotenv/config';
import { db } from '../db';
import { users, rolesSchema, userRolesSchema } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

async function assignUserRole() {
  const email = process.argv[2] || 'test0user@mail.com';
  
  try {
    // Get user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`\n👤 User: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   isAdmin: ${user.isAdmin}`);

    // Get User role
    const [userRole] = await db
      .select({ id: rolesSchema.id })
      .from(rolesSchema)
      .where(eq(rolesSchema.name, 'User'));

    if (!userRole) {
      console.log('❌ User role not found in database!');
      process.exit(1);
    }

    // Check if already assigned
    const existing = await db
      .select()
      .from(userRolesSchema)
      .where(
        and(
          eq(userRolesSchema.userId, user.id),
          eq(userRolesSchema.roleId, userRole.id)
        )
      );

    if (existing.length > 0) {
      console.log('✅ User role already assigned');
    } else {
      await db.insert(userRolesSchema).values({
        userId: user.id,
        roleId: userRole.id,
      });
      console.log('✅ User role assigned successfully');
    }

    // Show all roles
    const allRoles = await db
      .select({ roleName: rolesSchema.name })
      .from(userRolesSchema)
      .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
      .where(eq(userRolesSchema.userId, user.id));

    console.log('\n🎭 Current roles:');
    allRoles.forEach(r => console.log(`   - ${r.roleName}`));

    console.log('\n✅ User should now redirect to: /employee\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignUserRole();
