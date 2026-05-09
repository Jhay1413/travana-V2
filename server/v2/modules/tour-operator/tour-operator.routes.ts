import { Router } from 'express';
import { tourOperatorController } from './tour-operator.controller';

const router = Router();

router.get('/', tourOperatorController.listTourOperators);
router.get('/:id', tourOperatorController.getTourOperatorById);
router.post('/', tourOperatorController.createTourOperator);
router.patch('/:id', tourOperatorController.updateTourOperator);
router.delete('/:id', tourOperatorController.deleteTourOperator);

export default router;
