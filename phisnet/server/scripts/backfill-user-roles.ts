import 'dotenv/config';
import { db } from '../db';
import { users, rolesSchema, userRolesSchema } from '../../shared/schema';
import { eq, notInArray, sql } from 'drizzle-orm';

/**
 * Backfill User role for all non-admin users who have no roles assigned
 */
async function backfillUserRoles() {
  console.log('🔍 Starting User role backfill...\n');

  try {
    // Get the User role ID
    const [userRole] = await db
      .select({ id: rolesSchema.id })
      .from(rolesSchema)
      .where(eq(rolesSchema.name, 'User'))
      .limit(1);

    if (!userRole) {
      console.error('❌ User role not found in database!');
      console.log('Please run: npm run db:migrate');
      process.exit(1);
    }

    console.log(`✅ Found User role (ID: ${userRole.id})\n`);

    // Find all users who have no roles assigned and are not global admins
    const usersWithoutRoles = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(
        sql`${users.id} NOT IN (
          SELECT user_id FROM user_roles
        ) AND ${users.isAdmin} = false`
      );

    if (usersWithoutRoles.length === 0) {
      console.log('✅ All non-admin users already have roles assigned!\n');
      process.exit(0);
    }

    console.log(`📋 Found ${usersWithoutRoles.length} users without roles:\n`);
    
    for (const user of usersWithoutRoles) {
      console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
    }

    console.log('\n🔧 Assigning User role to these users...\n');

    // Insert User role for all these users
    const assignments = usersWithoutRoles.map(user => ({
      userId: user.id,
      roleId: userRole.id,
    }));

    await db.insert(userRolesSchema).values(assignments);

    console.log(`✅ Successfully assigned User role to ${usersWithoutRoles.length} users!\n`);

    // Verify assignments
    console.log('🔍 Verifying role assignments...\n');
    
    for (const user of usersWithoutRoles) {
      const roles = await db
        .select({ roleName: rolesSchema.name })
        .from(userRolesSchema)
        .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
        .where(eq(userRolesSchema.userId, user.id));
      
      console.log(`   ✓ ${user.email}: ${roles.map(r => r.roleName).join(', ')}`);
    }

    console.log('\n✅ Backfill complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

backfillUserRoles();
