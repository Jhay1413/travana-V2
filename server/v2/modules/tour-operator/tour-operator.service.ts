import { tourOperatorRepository } from './tour-operator.repository';
import { AppError } from '../../utils/error-handler';

export const tourOperatorService = {
  async listTourOperators() {
    return tourOperatorRepository.findAll();
  },

  async getTourOperatorById(id: string) {
    const tourOperator = await tourOperatorRepository.findById(id);
    if (!tourOperator) throw new AppError('Tour operator not found', 404);
    return tourOperator;
  },

  async createTourOperator(data: any) {
    return tourOperatorRepository.create(data);
  },

  async updateTourOperator(id: string, data: any) {
    const tourOperator = await tourOperatorRepository.update(id, data);
    if (!tourOperator) throw new AppError('Tour operator not found', 404);
    return tourOperator;
  },

  async deleteTourOperator(id: string) {
    await tourOperatorRepository.remove(id);
  },
};
