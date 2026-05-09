import { db } from '../../config/database';
import { eq, sql, ilike, or } from 'drizzle-orm';
import {
  accomodation_type, board_basis, country, destination, resorts, accomodation_list,
  tour_operator, package_type, tour_package_commission, park, cottages, lodges,
  cruise_extra_item, deletion_codes, room_type, deal_images, forwardsReport, airport, tags,
} from '@shared/schema';

export const tableMap: Record<string, any> = {
  accomodation_type, board_basis, country, destination, resorts, accomodation_list,
  tour_operator, package_type, tour_package_commission, park, cottages, lodges,
  cruise_extra_item, deletion_codes, room_type, deal_images, forwards_report: forwardsReport, airport, tags,
};

export const tableConfig: Record<string, { label: string; columns: string[]; searchFields: string[]; dependsOn: string[] }> = {
  country: { label: 'Countries', columns: ['id', 'country_name', 'country_code'], searchFields: ['country_name', 'country_code'], dependsOn: [] },
  destination: { label: 'Destinations', columns: ['id', 'name', 'type', 'country_id'], searchFields: ['name', 'type'], dependsOn: ['country'] },
  resorts: { label: 'Resorts', columns: ['id', 'name', 'destination_id'], searchFields: ['name'], dependsOn: ['destination'] },
  accomodation_type: { label: 'Accommodation Types', columns: ['id', 'type'], searchFields: ['type'], dependsOn: [] },
  accomodation_list: { label: 'Accommodation List', columns: ['id', 'type_id', 'name', 'resorts_id', 'description'], searchFields: ['name', 'description'], dependsOn: ['accomodation_type', 'resorts'] },
  board_basis: { label: 'Board Basis', columns: ['id', 'type'], searchFields: ['type'], dependsOn: [] },
  tour_operator: { label: 'Tour Operators', columns: ['id', 'name'], searchFields: ['name'], dependsOn: [] },
  package_type: { label: 'Package Types', columns: ['id', 'name'], searchFields: ['name'], dependsOn: [] },
  tour_package_commission: { label: 'Package Commissions', columns: ['package_type_id', 'tour_operator_id', 'percentage_commission'], searchFields: [], dependsOn: ['package_type', 'tour_operator'] },
  park: { label: 'Parks', columns: ['id', 'name', 'image_1', 'image_2', 'location', 'city', 'county', 'code', 'description'], searchFields: ['name', 'location', 'city'], dependsOn: [] },
  cottages: { label: 'Cottages', columns: ['id', 'cottage_name', 'location', 'cottage_code', 'bedrooms', 'bathrooms', 'sleeps', 'pets', 'image_1', 'image_2', 'details_url'], searchFields: ['cottage_name', 'location', 'cottage_code'], dependsOn: [] },
  lodges: { label: 'Lodges', columns: ['id', 'park_id', 'lodge_name', 'lodge_code', 'image', 'adults', 'children', 'bedrooms', 'bathrooms', 'pets', 'sleeps', 'infants'], searchFields: ['lodge_name', 'lodge_code'], dependsOn: ['park'] },
  cruise_extra_item: { label: 'Cruise Extras', columns: ['id', 'name'], searchFields: ['name'], dependsOn: [] },
  deletion_codes: { label: 'Deletion Codes', columns: ['id', 'code', 'description', 'is_used'], searchFields: ['code', 'description'], dependsOn: [] },
  room_type: { label: 'Room Types', columns: ['id', 'name'], searchFields: ['name'], dependsOn: [] },
  deal_images: { label: 'Deal Images', columns: ['id', 'image_url', 's3Key', 'owner_type', 'owner_id', 'isPrimary'], searchFields: ['image_url', 'owner_type'], dependsOn: [] },
  forwards_report: { label: 'Forwards Reports', columns: ['id', 'month', 'monthName', 'year', 'target', 'company_commission', 'agent_commission', 'adjustment', 'deal_ids', 'historical_ids'], searchFields: ['monthName'], dependsOn: [] },
  airport: { label: 'Airports', columns: ['id', 'airport_name', 'airport_code'], searchFields: ['airport_name', 'airport_code'], dependsOn: [] },
  tags: { label: 'Tags', columns: ['id', 'name', 'usageCount', 'createdAt', 'lastUsedAt'], searchFields: ['name'], dependsOn: [] },
};

export const adminImportRepository = {
  async getTableCounts() {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(tableMap)) {
      try {
        const [result] = await db.select({ count: sql<number>`count(*)` }).from(tableMap[key]);
        counts[key] = Number(result.count);
      } catch { counts[key] = 0; }
    }
    return counts;
  },

  async getData(tableName: string, page: number, limit: number, search: string) {
    const table = tableMap[tableName];
    const config = tableConfig[tableName];
    const offset = (page - 1) * limit;
    let whereClause: any;
    if (search && config?.searchFields?.length) {
      const conditions = config.searchFields.map((field: string) => ilike(table[field], `%${search}%`));
      whereClause = conditions.length === 1 ? conditions[0] : or(...conditions);
    }
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(table).where(whereClause);
    const rows = await db.select().from(table).where(whereClause).limit(limit).offset(offset);
    return { rows, total: Number(countResult.count) };
  },

  async createRow(tableName: string, row: any) {
    const table = tableMap[tableName];
    const result = await db.insert(table).values(row).returning();
    return Array.isArray(result) ? result[0] : result;
  },

  async updateRow(tableName: string, id: string, updates: any) {
    const table = tableMap[tableName];
    const { id: _id, ...safeUpdates } = updates;
    const result = await db.update(table).set(safeUpdates).where(eq(table.id, id)).returning();
    return Array.isArray(result) ? result[0] : result;
  },

  async deleteRow(tableName: string, id: string) {
    const table = tableMap[tableName];
    if (table.id) await db.delete(table).where(eq(table.id, id));
  },

  async importRows(tableName: string, rows: any[]) {
    const table = tableMap[tableName];
    let imported = 0;
    const errors: Array<{ row: number; error: string }> = [];
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(table).values(batch).onConflictDoNothing();
        imported += batch.length;
      } catch {
        for (let j = 0; j < batch.length; j++) {
          try { await db.insert(table).values(batch[j]).onConflictDoNothing(); imported++; }
          catch (rowErr: any) { errors.push({ row: i + j + 1, error: rowErr.message || 'Unknown error' }); }
        }
      }
    }
    return { imported, errors };
  },

  async clearTable(tableName: string) {
    const table = tableMap[tableName];
    await db.delete(table);
  },
};
