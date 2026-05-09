import { AppError } from '../../utils/error-handler';
import { inviteRepository } from './invite.repository';

export const inviteService = {
  async send(_data: any, _orgId: string, _branchId: string | null, _orgRole: string) {
    // TODO: check seat limit, create invite row, send email
    throw new AppError('Not yet implemented', 501);
  },
  async getByToken(_token: string) {
    throw new AppError('Not yet implemented', 501);
  },
  async acceptInvite(_token: string, _data: any) {
    throw new AppError('Not yet implemented', 501);
  },
  async listByOrg(orgId: string) {
    return inviteRepository.findAllByOrg(orgId);
  },
  async revoke(id: string, orgId: string) {
    await inviteRepository.revoke(id, orgId);
  },
};
