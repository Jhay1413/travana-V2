import { AppError } from './error-handler';

export const HOMEWORKER_INVITE_ONLY_MESSAGE = 'Homeworkers are created by invite; archive and re-invite instead';

/**
 * Moving a user into or out of the homeworker role is only possible through
 * invite / archive. `currentRoles` must be the full role union (junction rows
 * plus primary and membership roles) so a legacy {agent, homeworker} user is caught.
 */
export function assertNoHomeworkerRoleChange(currentRoles: ReadonlyArray<string | null | undefined>, toRole: string): void {
  const holdsHomeworker = currentRoles.includes('homeworker');
  if (holdsHomeworker !== (toRole === 'homeworker')) {
    throw new AppError(HOMEWORKER_INVITE_ONLY_MESSAGE, 400);
  }
}
