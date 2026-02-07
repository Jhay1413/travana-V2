import { Router, Request, Response } from "express";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import { db } from "../config/database";
import { eq, sql } from "drizzle-orm";
import {
  accomodation_type,
  board_basis,
  country,
  destination,
  resorts,
  accomodation_list,
  tour_operator,
  package_type,
  tour_package_commission,
  park,
  cottages,
  lodges,
  cruise_extra_item,
  deletion_codes,
  room_type,
  deal_images,
  forwardsReport,
} from "@shared/schema";

const router = Router();

const tableMap: Record<string, any> = {
  accomodation_type,
  board_basis,
  country,
  destination,
  resorts,
  accomodation_list,
  tour_operator,
  package_type,
  tour_package_commission,
  park,
  cottages,
  lodges,
  cruise_extra_item,
  deletion_codes,
  room_type,
  deal_images,
  forwards_report: forwardsReport,
};

router.use(isAuthenticated);

router.post(
  "/import/:tableName",
  asyncHandler(async (req: Request, res: Response) => {
    const tableName = req.params.tableName as string;
    const { rows } = req.body;

    const table = tableMap[tableName];
    if (!table) {
      return res.status(400).json({ success: false, message: `Unknown table: ${tableName}` });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "No rows provided" });
    }

    const errors: Array<{ row: number; error: string }> = [];
    let imported = 0;

    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(table).values(batch).onConflictDoNothing();
        imported += batch.length;
      } catch (batchErr: any) {
        for (let j = 0; j < batch.length; j++) {
          try {
            await db.insert(table).values(batch[j]).onConflictDoNothing();
            imported++;
          } catch (rowErr: any) {
            errors.push({ row: i + j + 1, error: rowErr.message || "Unknown error" });
          }
        }
      }
    }

    return successResponse(res, { imported, errors, total: rows.length }, `Import complete: ${imported}/${rows.length} rows imported`);
  })
);

router.get(
  "/tables",
  asyncHandler(async (req: Request, res: Response) => {
    const tables = [
      { key: "accomodation_type", label: "Accommodation Types", columns: ["id", "type"], dependsOn: [] },
      { key: "board_basis", label: "Board Basis", columns: ["id", "type"], dependsOn: [] },
      { key: "country", label: "Countries", columns: ["id", "country_name", "country_code"], dependsOn: [] },
      { key: "destination", label: "Destinations", columns: ["id", "name", "type", "country_id"], dependsOn: ["country"] },
      { key: "resorts", label: "Resorts", columns: ["id", "name", "destination_id"], dependsOn: ["destination"] },
      { key: "accomodation_list", label: "Accommodation List", columns: ["id", "type_id", "name", "resorts_id", "description"], dependsOn: ["accomodation_type", "resorts"] },
      { key: "tour_operator", label: "Tour Operators", columns: ["id", "name"], dependsOn: [] },
      { key: "package_type", label: "Package Types", columns: ["id", "name"], dependsOn: [] },
      { key: "tour_package_commission", label: "Tour Package Commissions", columns: ["package_type_id", "tour_operator_id", "percentage_commission"], dependsOn: ["package_type", "tour_operator"] },
      { key: "park", label: "Parks", columns: ["id", "name", "image_1", "image_2", "location", "city", "county", "code", "description"], dependsOn: [] },
      { key: "cottages", label: "Cottages", columns: ["id", "cottage_name", "location", "cottage_code", "bedrooms", "bathrooms", "sleeps", "pets", "image_1", "image_2", "details_url"], dependsOn: [] },
      { key: "lodges", label: "Lodges", columns: ["id", "park_id", "lodge_name", "lodge_code", "image", "adults", "children", "bedrooms", "bathrooms", "pets", "sleeps", "infants"], dependsOn: ["park"] },
      { key: "cruise_extra_item", label: "Cruise Extra Items", columns: ["id", "name"], dependsOn: [] },
      { key: "room_type", label: "Room Types", columns: ["id", "name"], dependsOn: [] },
      { key: "deal_images", label: "Deal Images", columns: ["id", "image_url", "s3Key", "owner_type", "owner_id", "isPrimary"], dependsOn: [] },
      { key: "forwards_report", label: "Forwards Reports", columns: ["id", "month", "monthName", "year", "target", "company_commission", "agent_commission", "adjustment", "deal_ids", "historical_ids"], dependsOn: [] },
    ];

    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const tbl = tableMap[t.key];
        const [result] = await db.select({ count: sql<number>`count(*)` }).from(tbl);
        counts[t.key] = Number(result.count);
      } catch {
        counts[t.key] = 0;
      }
    }

    return successResponse(res, { tables, counts }, "Tables retrieved");
  })
);

router.delete(
  "/clear/:tableName",
  asyncHandler(async (req: Request, res: Response) => {
    const tableName = req.params.tableName as string;
    const table = tableMap[tableName];
    if (!table) {
      return res.status(400).json({ success: false, message: `Unknown table: ${tableName}` });
    }
    await db.delete(table);
    return successResponse(res, null, `Table ${tableName} cleared`);
  })
);

export default router;
