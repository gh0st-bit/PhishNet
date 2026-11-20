import type { User } from '@shared/schema';

// Explicit allowlist: adding a sensitive database column must never expose it.
export function publicUser(user: User) {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    organizationId: user.organizationId, organizationName: user.organizationName,
    isAdmin: user.isAdmin, isActive: user.isActive, emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled, profilePicture: user.profilePicture,
    position: user.position, bio: user.bio, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
