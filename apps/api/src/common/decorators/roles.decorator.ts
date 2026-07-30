import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@ai-career/shared';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route/controller to the given roles.
 * Usage: `@Roles(UserRole.ADMIN)` — enforced by RolesGuard (registered globally).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
