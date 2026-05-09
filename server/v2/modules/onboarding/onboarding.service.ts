import { AppError } from '../../utils/error-handler';

export const onboardingService = {
  async signup(_data: {
    agencyName: string;
    slug: string;
    brandColor?: string;
    logoUrl?: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    // TODO: atomically create organization + default branch + owner user
    // Then send email verification link
    throw new AppError('Not yet implemented', 501);
  },

  async verifyEmail(_token: string) {
    // TODO: verify signed token, mark user.emailVerified = true
    throw new AppError('Not yet implemented', 501);
  },
};
