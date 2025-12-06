import 'dotenv/config';
import { db } from '../db';
import { users, rolesSchema, userRolesSchema } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

async function makeUserAdmin() {
  try {
    // Find the user
    const [user] = await db.select().from(users).where(eq(users.email, 'umarwaqar@mail.com'));
    
    if (!user) {
      console.log('❌ User umarwaqar@mail.com not found');
      process.exit(1);
    }

    console.log('📋 Current user status:', {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      organizationId: user.organizationId,
    });

    // Update isAdmin flag to true
    await db.update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, user.id));
    
    console.log('✅ Set isAdmin = true');

    // Get Admin role
    const [adminRole] = await db.select()
      .from(rolesSchema)
      .where(eq(rolesSchema.name, 'Admin'));

    if (!adminRole) {
      console.log('❌ Admin role not found in roles table');
      process.exit(1);
    }

    // Check if user already has Admin role
    const existingAdminRole = await db.select()
      .from(userRolesSchema)
      .where(and(
        eq(userRolesSchema.userId, user.id),
        eq(userRolesSchema.roleId, adminRole.id)
      ));

    if (existingAdminRole.length > 0) {
      console.log('↻ User already has Admin role');
    } else {
      // Assign Admin role
      await db.insert(userRolesSchema).values({
        userId: user.id,
        roleId: adminRole.id,
      });
      console.log('✅ Assigned Admin role');
    }

    // Verify the changes
    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
    const userRoles = await db.select()
      .from(userRolesSchema)
      .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
      .where(eq(userRolesSchema.userId, user.id));

    console.log('\n✅ User updated successfully!');
    console.log('📋 New status:', {
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      roles: userRoles.map(r => r.roles.name),
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

makeUserAdmin();
