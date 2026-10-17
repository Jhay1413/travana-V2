import { userSessionRepository } from './user-session.repository';
import { realtimeService } from '../../realtime/realtime.service';

export const userAccessService = {
  /**
   * Ends a user's live access after their account state changed (suspend, remove,
   * archive, platform deactivate): deletes their sessions in the session store's
   * database and closes their open realtime (SSE) streams. Call only after the
   * data change has committed. Returns how many sessions were deleted.
   */
  async revokeAccess(userId: string): Promise<number> {
    const sessionsDeleted = await userSessionRepository.deleteByUserId(userId);
    realtimeService.closeUserConnections(userId);
    return sessionsDeleted;
  },
};
