import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { getRequestActor } from '../../utils/request-actor';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';
import { tourOperatorImportService } from './tour-operator-import.service';
import { tourOperatorService } from './tour-operator.service';
import { catalogueQuery, createLinkBody, importBody, listQuery, patchLinkBody } from './tour-operator.validator';

// validate() does not write parsed values back, so each handler parses again to
// pick up Zod defaults, trimming and website normalisation.

export const tourOperatorController = {
  listOptions: asyncHandler(async (req: Request, res: Response) => {
    const q = listQuery.parse(req.query);
    const data = await tourOperatorService.listOptions(getScope(req), q.includeInactive === '1');
    return successResponse(res, data, 'Tour operators retrieved successfully');
  }),

  listManage: asyncHandler(async (req: Request, res: Response) => {
    const q = listQuery.parse(req.query);
    const data = await tourOperatorService.listManage(getScope(req), q.includeInactive === '1');
    return successResponse(res, data, 'Tour operators retrieved successfully');
  }),

  searchCatalogue: asyncHandler(async (req: Request, res: Response) => {
    const q = catalogueQuery.parse(req.query);
    const data = await tourOperatorService.searchCatalogue(getScope(req), q.q, q.all === '1');
    return successResponse(res, data, 'Catalogue retrieved successfully');
  }),

  exportCsv: asyncHandler(async (req: Request, res: Response) => {
    const csv = await tourOperatorService.exportCsv(getScope(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tour-operators.csv"');
    res.status(200).send(csv);
  }),

  previewImport: asyncHandler(async (req: Request, res: Response) => {
    const body = importBody.parse(req.body);
    const data = await tourOperatorImportService.preview(getScope(req), body.rows);
    return successResponse(res, data, 'Import checked successfully');
  }),

  applyImport: asyncHandler(async (req: Request, res: Response) => {
    const body = importBody.parse(req.body);
    const data = await tourOperatorImportService.apply(getScope(req), body.rows);
    return successResponse(res, data, 'Import completed successfully');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createLinkBody.parse(req.body);
    const data = await tourOperatorService.createLink(getScope(req), body);
    return successResponse(res, data, 'Tour operator added successfully', 201);
  }),

  revealPassword: asyncHandler(async (req: Request, res: Response) => {
    const data = await tourOperatorService.revealPassword(getScope(req), String(req.params.linkId), getRequestActor(req));
    return successResponse(res, data, 'Password retrieved successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const body = patchLinkBody.parse(req.body);
    const data = await tourOperatorService.updateLink(getScope(req), String(req.params.linkId), body);
    return successResponse(res, data, 'Tour operator updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tourOperatorService.removeLink(getScope(req), String(req.params.linkId));
    return successResponse(res, { ok: true }, 'Tour operator removed successfully');
  }),
};
