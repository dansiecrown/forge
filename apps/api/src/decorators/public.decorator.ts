import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks an endpoint as not requiring an access token. Used for sign-in,
 * password reset, email verification and other pre-authentication routes. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
