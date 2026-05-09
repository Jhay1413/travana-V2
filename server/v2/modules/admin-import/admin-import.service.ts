import { adminImportRepository, tableMap, tableConfig } from './admin-import.repository';
import { AppError } from '../../utils/error-handler';

export const adminImportService = {
  async getTables() {
    const tables = Object.entries(tableConfig).map(([key, cfg]) => ({ key, label: cfg.label, columns: cfg.columns, dependsOn: cfg.dependsOn }));
    const counts = await adminImportRepository.getTableCounts();
    return { tables, counts };
  },

  async getData(tableName: string, page: number, limit: number, search: string) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    const { rows, total } = await adminImportRepository.getData(tableName, page, limit, search);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async createRow(tableName: string, row: any) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    return adminImportRepository.createRow(tableName, row);
  },

  async updateRow(tableName: string, id: string, updates: any) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    return adminImportRepository.updateRow(tableName, id, updates);
  },

  async deleteRow(tableName: string, id: string) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    await adminImportRepository.deleteRow(tableName, id);
  },

  async importRows(tableName: string, rows: any[]) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    if (!Array.isArray(rows) || rows.length === 0) throw new AppError('No rows provided', 400);
    const { imported, errors } = await adminImportRepository.importRows(tableName, rows);
    return { imported, errors, total: rows.length };
  },

  async clearTable(tableName: string) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    await adminImportRepository.clearTable(tableName);
  },
};
