import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Allows a route to be reached with or without credentials.
 * When a valid token is present `req.user` is populated (enabling personalized
 * responses such as `isSaved` flags and early-access job visibility); when it is
 * absent or invalid the request proceeds anonymously instead of failing with 401.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
