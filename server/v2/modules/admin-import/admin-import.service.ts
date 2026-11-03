import { adminImportRepository, tableMap, tableConfig } from './admin-import.repository';
import { AppError } from '../../utils/error-handler';

// The tour operator catalogue is platform-wide: only its identity columns can be
// written here (commission, login and the like live per organisation in
// org_tour_operator), and rows can never be deleted or cleared from this tool
// because the cascade would wipe every organisation's operator settings.
const CATALOGUE_TABLE = 'tour_operator';

function pickCatalogueColumns(row: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(tableConfig[CATALOGUE_TABLE].columns);
  return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
}

function sanitizeRow(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
  return tableName === CATALOGUE_TABLE ? pickCatalogueColumns(row) : row;
}

/** Columns an old CSV may still carry that the catalogue no longer stores. */
const DROPPED_CATALOGUE_COLUMNS = ['commission_percentage', 'org_id'];

function droppedColumnWarnings(tableName: string, rows: Array<Record<string, unknown>>): string[] {
  if (tableName !== CATALOGUE_TABLE) return [];
  const dropped = DROPPED_CATALOGUE_COLUMNS.filter((col) => rows.some((r) => r[col] !== undefined && r[col] !== null && r[col] !== ''));
  if (dropped.length === 0) return [];
  return [
    `Ignored column(s) ${dropped.join(', ')}: the platform catalogue no longer stores them. Commission is set per agency on the Tour Operators page.`,
  ];
}

function refuseCatalogueDelete(tableName: string): void {
  if (tableName === CATALOGUE_TABLE) {
    throw new AppError('Tour operators cannot be deleted or cleared here. Remove them from the platform catalogue page instead.', 400);
  }
}

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
    return adminImportRepository.createRow(tableName, sanitizeRow(tableName, row));
  },

  async updateRow(tableName: string, id: string, updates: any) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    return adminImportRepository.updateRow(tableName, id, sanitizeRow(tableName, updates));
  },

  async deleteRow(tableName: string, id: string) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    refuseCatalogueDelete(tableName);
    await adminImportRepository.deleteRow(tableName, id);
  },

  async importRows(tableName: string, rows: any[]) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    if (!Array.isArray(rows) || rows.length === 0) throw new AppError('No rows provided', 400);
    const cleanRows = tableName === CATALOGUE_TABLE ? rows.map((r) => pickCatalogueColumns(r)) : rows;
    const { imported, errors } = await adminImportRepository.importRows(tableName, cleanRows);
    return { imported, errors, total: rows.length, warnings: droppedColumnWarnings(tableName, rows) };
  },

  async clearTable(tableName: string) {
    if (!tableMap[tableName]) throw new AppError(`Unknown table: ${tableName}`, 400);
    refuseCatalogueDelete(tableName);
    await adminImportRepository.clearTable(tableName);
  },
};
