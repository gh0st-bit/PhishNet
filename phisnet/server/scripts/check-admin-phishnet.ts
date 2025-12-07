import 'dotenv/config';
import { db } from '../db';
import { users, organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
  const [user] = await db.select().from(users).where(eq(users.email, 'admin@phishnet.com'));
  
  if (!user) {
    console.log('❌ admin@phishnet.com not found');
    process.exit(1);
  }

  console.log('✅ Found user:', {
    id: user.id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin,
    organizationId: user.organizationId,
  });

  if (user.organizationId) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
    if (org) {
      console.log('✅ Organization:', {
        id: org.id,
        name: org.name,
      });
    }
  } else {
    console.log('⚠️ User has no organization assigned');
  }

  process.exit(0);
}

checkUser();
