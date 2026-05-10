import { tourOperatorRepository } from './tour-operator.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

export const tourOperatorService = {
  async listTourOperators(scope: Scope) {
    return tourOperatorRepository.findAll(scope);
  },

  async getTourOperatorById(id: string, scope: Scope) {
    const tourOperator = await tourOperatorRepository.findById(id, scope);
    if (!tourOperator) throw new AppError('Tour operator not found', 404);
    return tourOperator;
  },

  async createTourOperator(data: any, scope: Scope) {
    return tourOperatorRepository.create(data, scope);
  },

  async updateTourOperator(id: string, data: any, scope: Scope) {
    const tourOperator = await tourOperatorRepository.update(id, data, scope);
    if (!tourOperator) throw new AppError('Tour operator not found', 404);
    return tourOperator;
  },

  async deleteTourOperator(id: string, scope: Scope) {
    const removed = await tourOperatorRepository.remove(id, scope);
    if (!removed) throw new AppError('Tour operator not found', 404);
  },
};
