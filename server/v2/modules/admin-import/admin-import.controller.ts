import { Request, Response } from 'express';
import { adminImportService } from './admin-import.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const adminImportController = {
  getTables: asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminImportService.getTables();
    return successResponse(res, result, 'Tables retrieved');
  }),

  getData: asyncHandler(async (req: Request, res: Response) => {
    const tableName = req.params.tableName as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const search = ((req.query.search as string) || '').trim();
    const result = await adminImportService.getData(tableName, page, limit, search);
    return successResponse(res, result, `${tableName} data retrieved`);
  }),

  createRow: asyncHandler(async (req: Request, res: Response) => {
    const tableName = req.params.tableName as string;
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, message: 'Invalid row data' });
    const row = await adminImportService.createRow(tableName, req.body);
    return successResponse(res, row, 'Row created');
  }),

  updateRow: asyncHandler(async (req: Request, res: Response) => {
    const tableName = req.params.tableName as string;
    const id = req.params.id as string;
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, message: 'Invalid update data' });
    const row = await adminImportService.updateRow(tableName, id, req.body);
    return successResponse(res, row, 'Row updated');
  }),

  deleteRow: asyncHandler(async (req: Request, res: Response) => {
    await adminImportService.deleteRow(req.params.tableName as string, req.params.id as string);
    return successResponse(res, null, 'Row deleted');
  }),

  importRows: asyncHandler(async (req: Request, res: Response) => {
    const { rows } = req.body;
    const result = await adminImportService.importRows(req.params.tableName as string, rows);
    return successResponse(res, result, `Import complete: ${result.imported}/${result.total} rows imported`);
  }),

  clearTable: asyncHandler(async (req: Request, res: Response) => {
    await adminImportService.clearTable(req.params.tableName as string);
    return successResponse(res, null, `Table ${(req.params.tableName as string)} cleared`);
  }),
};
