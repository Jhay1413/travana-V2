import { Router, Request, Response } from "express";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import { db } from "../config/database";
import { sql, ilike, or, eq, asc } from "drizzle-orm";
import {
  tour_operator,
  airport,
  country,
  destination,
  resorts,
  accomodation_type,
  accomodation_list,
  board_basis,
  package_type,
  tour_package_commission,
  park,
  cottages,
  lodges,
  cruise_extra_item,
  deletion_codes,
  room_type,
  cruise_line,
  cruise_ship,
  cruise_itenary,
  cruise_voyage,
} from "@shared/schema";

const router = Router();
router.use(isAuthenticated);

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || "").trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

function buildPaginatedResponse(rows: any[], total: number, page: number, limit: number) {
  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── TOUR OPERATORS ─────────────────────────────────────────────────────────

router.get(
  "/tour-operators",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(tour_operator.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tour_operator).where(where);
    const rows = await db.select().from(tour_operator).where(where).orderBy(asc(tour_operator.name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Tour operators retrieved");
  })
);

router.get(
  "/tour-operators/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(tour_operator).where(eq(tour_operator.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Tour operator retrieved");
  })
);

router.post(
  "/tour-operators",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(tour_operator).values(data).returning();
    return successResponse(res, row, "Tour operator created", 201);
  })
);

router.patch(
  "/tour-operators/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(tour_operator).set(updates).where(eq(tour_operator.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Tour operator updated");
  })
);

router.delete(
  "/tour-operators/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(tour_operator).where(eq(tour_operator.id, req.params.id));
    res.status(204).send();
  })
);

// ─── AIRPORTS ───────────────────────────────────────────────────────────────

router.get(
  "/airports",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(airport.airport_name, `%${search}%`), ilike(airport.airport_code, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(airport).where(where);
    const rows = await db.select().from(airport).where(where).orderBy(asc(airport.airport_name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Airports retrieved");
  })
);

router.get(
  "/airports/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(airport).where(eq(airport.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Airport retrieved");
  })
);

router.post(
  "/airports",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(airport).values(data).returning();
    return successResponse(res, row, "Airport created", 201);
  })
);

router.patch(
  "/airports/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(airport).set(updates).where(eq(airport.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Airport updated");
  })
);

router.delete(
  "/airports/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(airport).where(eq(airport.id, req.params.id));
    res.status(204).send();
  })
);

// ─── COUNTRIES ──────────────────────────────────────────────────────────────

router.get(
  "/countries",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(country.country_name, `%${search}%`), ilike(country.country_code, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(country).where(where);
    const rows = await db.select().from(country).where(where).orderBy(asc(country.country_name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Countries retrieved");
  })
);

router.get(
  "/countries/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(country).where(eq(country.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Country retrieved");
  })
);

router.post(
  "/countries",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(country).values(data).returning();
    return successResponse(res, row, "Country created", 201);
  })
);

router.patch(
  "/countries/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(country).set(updates).where(eq(country.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Country updated");
  })
);

router.delete(
  "/countries/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(country).where(eq(country.id, req.params.id));
    res.status(204).send();
  })
);

// ─── DESTINATIONS ───────────────────────────────────────────────────────────

router.get(
  "/destinations",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(destination.name, `%${search}%`), ilike(destination.type, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(destination).where(where);
    const rows = await db
      .select({
        id: destination.id,
        name: destination.name,
        type: destination.type,
        country_id: destination.country_id,
        country_name: country.country_name,
      })
      .from(destination)
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(where)
      .orderBy(asc(destination.name))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Destinations retrieved");
  })
);

router.get(
  "/destinations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(destination).where(eq(destination.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Destination retrieved");
  })
);

router.post(
  "/destinations",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(destination).values(data).returning();
    return successResponse(res, row, "Destination created", 201);
  })
);

router.patch(
  "/destinations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(destination).set(updates).where(eq(destination.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Destination updated");
  })
);

router.delete(
  "/destinations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(destination).where(eq(destination.id, req.params.id));
    res.status(204).send();
  })
);

// ─── RESORTS ────────────────────────────────────────────────────────────────

router.get(
  "/resorts",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(resorts.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(resorts).where(where);
    const rows = await db
      .select({
        id: resorts.id,
        name: resorts.name,
        destination_id: resorts.destination_id,
        destination_name: destination.name,
      })
      .from(resorts)
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .where(where)
      .orderBy(asc(resorts.name))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Resorts retrieved");
  })
);

router.get(
  "/resorts/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(resorts).where(eq(resorts.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Resort retrieved");
  })
);

router.post(
  "/resorts",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(resorts).values(data).returning();
    return successResponse(res, row, "Resort created", 201);
  })
);

router.patch(
  "/resorts/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(resorts).set(updates).where(eq(resorts.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Resort updated");
  })
);

router.delete(
  "/resorts/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(resorts).where(eq(resorts.id, req.params.id));
    res.status(204).send();
  })
);

// ─── ACCOMMODATION TYPES ─────────────────────────────────────────────────────

router.get(
  "/accommodation-types",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(accomodation_type.type, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accomodation_type).where(where);
    const rows = await db.select().from(accomodation_type).where(where).orderBy(asc(accomodation_type.type)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Accommodation types retrieved");
  })
);

router.get(
  "/accommodation-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(accomodation_type).where(eq(accomodation_type.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Accommodation type retrieved");
  })
);

router.post(
  "/accommodation-types",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(accomodation_type).values(data).returning();
    return successResponse(res, row, "Accommodation type created", 201);
  })
);

router.patch(
  "/accommodation-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(accomodation_type).set(updates).where(eq(accomodation_type.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Accommodation type updated");
  })
);

router.delete(
  "/accommodation-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(accomodation_type).where(eq(accomodation_type.id, req.params.id));
    res.status(204).send();
  })
);

// ─── ACCOMMODATION LIST ──────────────────────────────────────────────────────

router.get(
  "/accommodation-list",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(accomodation_list.name, `%${search}%`), ilike(accomodation_list.description, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accomodation_list).where(where);
    const rows = await db
      .select({
        id: accomodation_list.id,
        name: accomodation_list.name,
        description: accomodation_list.description,
        resorts_id: accomodation_list.resorts_id,
        type_id: accomodation_list.type_id,
        resort_name: resorts.name,
        accommodation_type_name: accomodation_type.type,
        destination_name: destination.name,
        country_name: country.country_name,
      })
      .from(accomodation_list)
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(accomodation_type, eq(accomodation_list.type_id, accomodation_type.id))
      .where(where)
      .orderBy(asc(accomodation_list.name))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Accommodation list retrieved");
  })
);

router.get(
  "/accommodation-list/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(accomodation_list).where(eq(accomodation_list.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Accommodation retrieved");
  })
);

router.post(
  "/accommodation-list",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(accomodation_list).values(data).returning();
    return successResponse(res, row, "Accommodation created", 201);
  })
);

router.patch(
  "/accommodation-list/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(accomodation_list).set(updates).where(eq(accomodation_list.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Accommodation updated");
  })
);

router.delete(
  "/accommodation-list/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(accomodation_list).where(eq(accomodation_list.id, req.params.id));
    res.status(204).send();
  })
);

// ─── BOARD BASIS ─────────────────────────────────────────────────────────────

router.get(
  "/board-basis",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(board_basis.type, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(board_basis).where(where);
    const rows = await db.select().from(board_basis).where(where).orderBy(asc(board_basis.type)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Board basis retrieved");
  })
);

router.get(
  "/board-basis/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(board_basis).where(eq(board_basis.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Board basis retrieved");
  })
);

router.post(
  "/board-basis",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(board_basis).values(data).returning();
    return successResponse(res, row, "Board basis created", 201);
  })
);

router.patch(
  "/board-basis/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(board_basis).set(updates).where(eq(board_basis.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Board basis updated");
  })
);

router.delete(
  "/board-basis/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(board_basis).where(eq(board_basis.id, req.params.id));
    res.status(204).send();
  })
);

// ─── PACKAGE TYPES ───────────────────────────────────────────────────────────

router.get(
  "/package-types",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(package_type.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(package_type).where(where);
    const rows = await db.select().from(package_type).where(where).orderBy(asc(package_type.name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Package types retrieved");
  })
);

router.get(
  "/package-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(package_type).where(eq(package_type.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Package type retrieved");
  })
);

router.post(
  "/package-types",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(package_type).values(data).returning();
    return successResponse(res, row, "Package type created", 201);
  })
);

router.patch(
  "/package-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(package_type).set(updates).where(eq(package_type.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Package type updated");
  })
);

router.delete(
  "/package-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(package_type).where(eq(package_type.id, req.params.id));
    res.status(204).send();
  })
);

// ─── PACKAGE COMMISSIONS ─────────────────────────────────────────────────────

router.get(
  "/package-commissions",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, offset } = parsePagination(req.query);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tour_package_commission);
    const rows = await db
      .select({
        package_type_id: tour_package_commission.package_type_id,
        tour_operator_id: tour_package_commission.tour_operator_id,
        percentage_commission: tour_package_commission.percentage_commission,
        package_type_name: package_type.name,
        tour_operator_name: tour_operator.name,
      })
      .from(tour_package_commission)
      .leftJoin(package_type, eq(tour_package_commission.package_type_id, package_type.id))
      .leftJoin(tour_operator, eq(tour_package_commission.tour_operator_id, tour_operator.id))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Package commissions retrieved");
  })
);

router.post(
  "/package-commissions",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.insert(tour_package_commission).values(req.body).returning();
    return successResponse(res, row, "Package commission created", 201);
  })
);

router.patch(
  "/package-commissions/:packageTypeId/:tourOperatorId",
  asyncHandler(async (req: Request, res: Response) => {
    const { packageTypeId, tourOperatorId } = req.params;
    const { id: _id, ...updates } = req.body;
    const [row] = await db
      .update(tour_package_commission)
      .set(updates)
      .where(
        sql`${tour_package_commission.package_type_id} = ${packageTypeId} AND ${tour_package_commission.tour_operator_id} = ${tourOperatorId}`
      )
      .returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Package commission updated");
  })
);

router.delete(
  "/package-commissions/:packageTypeId/:tourOperatorId",
  asyncHandler(async (req: Request, res: Response) => {
    const { packageTypeId, tourOperatorId } = req.params;
    await db
      .delete(tour_package_commission)
      .where(
        sql`${tour_package_commission.package_type_id} = ${packageTypeId} AND ${tour_package_commission.tour_operator_id} = ${tourOperatorId}`
      );
    res.status(204).send();
  })
);

// ─── PARKS ───────────────────────────────────────────────────────────────────

router.get(
  "/parks",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(park.name, `%${search}%`), ilike(park.location, `%${search}%`), ilike(park.city, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(park).where(where);
    const rows = await db.select().from(park).where(where).orderBy(asc(park.name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Parks retrieved");
  })
);

router.get(
  "/parks/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(park).where(eq(park.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Park retrieved");
  })
);

router.post(
  "/parks",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(park).values(data).returning();
    return successResponse(res, row, "Park created", 201);
  })
);

router.patch(
  "/parks/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(park).set(updates).where(eq(park.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Park updated");
  })
);

router.delete(
  "/parks/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(park).where(eq(park.id, req.params.id));
    res.status(204).send();
  })
);

// ─── COTTAGES ────────────────────────────────────────────────────────────────

router.get(
  "/cottages",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(cottages.cottage_name, `%${search}%`), ilike(cottages.cottage_code, `%${search}%`), ilike(cottages.location, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cottages).where(where);
    const rows = await db.select().from(cottages).where(where).orderBy(asc(cottages.cottage_name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Cottages retrieved");
  })
);

router.get(
  "/cottages/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(cottages).where(eq(cottages.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cottage retrieved");
  })
);

router.post(
  "/cottages",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(cottages).values(data).returning();
    return successResponse(res, row, "Cottage created", 201);
  })
);

router.patch(
  "/cottages/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(cottages).set(updates).where(eq(cottages.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cottage updated");
  })
);

router.delete(
  "/cottages/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(cottages).where(eq(cottages.id, req.params.id));
    res.status(204).send();
  })
);

// ─── LODGES ──────────────────────────────────────────────────────────────────

router.get(
  "/lodges",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(lodges.lodge_name, `%${search}%`), ilike(lodges.lodge_code, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lodges).where(where);
    const rows = await db
      .select({
        id: lodges.id,
        lodge_name: lodges.lodge_name,
        lodge_code: lodges.lodge_code,
        park_id: lodges.park_id,
        park_name: park.name,
        adults: lodges.adults,
        children: lodges.children,
        infants: lodges.infants,
        bedrooms: lodges.bedrooms,
        bathrooms: lodges.bathrooms,
        sleeps: lodges.sleeps,
        pets: lodges.pets,
        image: lodges.image,
      })
      .from(lodges)
      .leftJoin(park, eq(lodges.park_id, park.id))
      .where(where)
      .orderBy(asc(lodges.lodge_name))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Lodges retrieved");
  })
);

router.get(
  "/lodges/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(lodges).where(eq(lodges.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Lodge retrieved");
  })
);

router.post(
  "/lodges",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(lodges).values(data).returning();
    return successResponse(res, row, "Lodge created", 201);
  })
);

router.patch(
  "/lodges/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(lodges).set(updates).where(eq(lodges.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Lodge updated");
  })
);

router.delete(
  "/lodges/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(lodges).where(eq(lodges.id, req.params.id));
    res.status(204).send();
  })
);

// ─── CRUISE EXTRAS ───────────────────────────────────────────────────────────

router.get(
  "/cruise-extras",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(cruise_extra_item.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cruise_extra_item).where(where);
    const rows = await db.select().from(cruise_extra_item).where(where).orderBy(asc(cruise_extra_item.name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Cruise extras retrieved");
  })
);

router.get(
  "/cruise-extras/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(cruise_extra_item).where(eq(cruise_extra_item.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise extra retrieved");
  })
);

router.post(
  "/cruise-extras",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(cruise_extra_item).values(data).returning();
    return successResponse(res, row, "Cruise extra created", 201);
  })
);

router.patch(
  "/cruise-extras/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(cruise_extra_item).set(updates).where(eq(cruise_extra_item.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise extra updated");
  })
);

router.delete(
  "/cruise-extras/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(cruise_extra_item).where(eq(cruise_extra_item.id, req.params.id));
    res.status(204).send();
  })
);

// ─── ROOM TYPES ──────────────────────────────────────────────────────────────

router.get(
  "/room-types",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(room_type.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(room_type).where(where);
    const rows = await db.select().from(room_type).where(where).orderBy(asc(room_type.name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Room types retrieved");
  })
);

router.get(
  "/room-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(room_type).where(eq(room_type.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Room type retrieved");
  })
);

router.post(
  "/room-types",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(room_type).values(data).returning();
    return successResponse(res, row, "Room type created", 201);
  })
);

router.patch(
  "/room-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(room_type).set(updates).where(eq(room_type.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Room type updated");
  })
);

router.delete(
  "/room-types/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(room_type).where(eq(room_type.id, req.params.id));
    res.status(204).send();
  })
);

// ─── DELETION CODES ──────────────────────────────────────────────────────────

router.get(
  "/deletion-codes",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(deletion_codes.code, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(deletion_codes).where(where);
    const rows = await db.select().from(deletion_codes).where(where).orderBy(asc(deletion_codes.code)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Deletion codes retrieved");
  })
);

router.get(
  "/deletion-codes/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(deletion_codes).where(eq(deletion_codes.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Deletion code retrieved");
  })
);

router.post(
  "/deletion-codes",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(deletion_codes).values(data).returning();
    return successResponse(res, row, "Deletion code created", 201);
  })
);

router.patch(
  "/deletion-codes/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(deletion_codes).set(updates).where(eq(deletion_codes.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Deletion code updated");
  })
);

router.delete(
  "/deletion-codes/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(deletion_codes).where(eq(deletion_codes.id, req.params.id));
    res.status(204).send();
  })
);

// ─── CRUISE LINES ────────────────────────────────────────────────────────────

router.get(
  "/cruise-lines",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(cruise_line.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cruise_line).where(where);
    const rows = await db.select().from(cruise_line).where(where).orderBy(asc(cruise_line.name)).limit(limit).offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Cruise lines retrieved");
  })
);

router.get(
  "/cruise-lines/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(cruise_line).where(eq(cruise_line.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise line retrieved");
  })
);

router.post(
  "/cruise-lines",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(cruise_line).values(data).returning();
    return successResponse(res, row, "Cruise line created", 201);
  })
);

router.patch(
  "/cruise-lines/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(cruise_line).set(updates).where(eq(cruise_line.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise line updated");
  })
);

router.delete(
  "/cruise-lines/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(cruise_line).where(eq(cruise_line.id, req.params.id));
    res.status(204).send();
  })
);

// ─── CRUISE SHIPS ────────────────────────────────────────────────────────────

router.get(
  "/cruise-ships",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const cruiseLineAlias = cruise_line;
    const where = search
      ? or(ilike(cruise_ship.name, `%${search}%`), ilike(cruiseLineAlias.name, `%${search}%`))
      : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cruise_ship)
      .leftJoin(cruiseLineAlias, eq(cruise_ship.cruise_line_id, cruiseLineAlias.id))
      .where(where);
    const rows = await db
      .select({
        id: cruise_ship.id,
        name: cruise_ship.name,
        cruise_line_id: cruise_ship.cruise_line_id,
        cruise_line_name: cruiseLineAlias.name,
      })
      .from(cruise_ship)
      .leftJoin(cruiseLineAlias, eq(cruise_ship.cruise_line_id, cruiseLineAlias.id))
      .where(where)
      .orderBy(asc(cruise_ship.name))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Cruise ships retrieved");
  })
);

router.get(
  "/cruise-ships/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(cruise_ship).where(eq(cruise_ship.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise ship retrieved");
  })
);

router.post(
  "/cruise-ships",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(cruise_ship).values(data).returning();
    return successResponse(res, row, "Cruise ship created", 201);
  })
);

router.patch(
  "/cruise-ships/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(cruise_ship).set(updates).where(eq(cruise_ship.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise ship updated");
  })
);

router.delete(
  "/cruise-ships/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(cruise_ship).where(eq(cruise_ship.id, req.params.id));
    res.status(204).send();
  })
);

// ─── CRUISE ITINERARIES ──────────────────────────────────────────────────────

router.get(
  "/cruise-itineraries",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search
      ? or(ilike(cruise_itenary.itenary, `%${search}%`), ilike(cruise_itenary.departure_port, `%${search}%`))
      : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cruise_itenary)
      .leftJoin(cruise_ship, eq(cruise_itenary.ship_id, cruise_ship.id))
      .where(where);
    const rows = await db
      .select({
        id: cruise_itenary.id,
        itenary: cruise_itenary.itenary,
        departure_port: cruise_itenary.departure_port,
        date: cruise_itenary.date,
        ship_id: cruise_itenary.ship_id,
        ship_name: cruise_ship.name,
      })
      .from(cruise_itenary)
      .leftJoin(cruise_ship, eq(cruise_itenary.ship_id, cruise_ship.id))
      .where(where)
      .orderBy(asc(cruise_itenary.date))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Cruise itineraries retrieved");
  })
);

router.get(
  "/cruise-itineraries/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(cruise_itenary).where(eq(cruise_itenary.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise itinerary retrieved");
  })
);

router.post(
  "/cruise-itineraries",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(cruise_itenary).values(data).returning();
    return successResponse(res, row, "Cruise itinerary created", 201);
  })
);

router.patch(
  "/cruise-itineraries/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(cruise_itenary).set(updates).where(eq(cruise_itenary.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise itinerary updated");
  })
);

router.delete(
  "/cruise-itineraries/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(cruise_itenary).where(eq(cruise_itenary.id, req.params.id));
    res.status(204).send();
  })
);

// ─── CRUISE VOYAGES ──────────────────────────────────────────────────────────

router.get(
  "/cruise-voyages",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, offset } = parsePagination(req.query);
    const where = search ? ilike(cruise_voyage.description, `%${search}%`) : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cruise_voyage)
      .leftJoin(cruise_itenary, eq(cruise_voyage.itinerary_id, cruise_itenary.id))
      .where(where);
    const rows = await db
      .select({
        id: cruise_voyage.id,
        day_number: cruise_voyage.day_number,
        description: cruise_voyage.description,
        itinerary_id: cruise_voyage.itinerary_id,
        itinerary_name: cruise_itenary.itenary,
      })
      .from(cruise_voyage)
      .leftJoin(cruise_itenary, eq(cruise_voyage.itinerary_id, cruise_itenary.id))
      .where(where)
      .orderBy(asc(cruise_voyage.day_number))
      .limit(limit)
      .offset(offset);
    return successResponse(res, buildPaginatedResponse(rows, Number(count), page, limit), "Cruise voyages retrieved");
  })
);

router.get(
  "/cruise-voyages/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(cruise_voyage).where(eq(cruise_voyage.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise voyage retrieved");
  })
);

router.post(
  "/cruise-voyages",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...data } = req.body;
    const [row] = await db.insert(cruise_voyage).values(data).returning();
    return successResponse(res, row, "Cruise voyage created", 201);
  })
);

router.patch(
  "/cruise-voyages/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: _id, ...updates } = req.body;
    const [row] = await db.update(cruise_voyage).set(updates).where(eq(cruise_voyage.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    return successResponse(res, row, "Cruise voyage updated");
  })
);

router.delete(
  "/cruise-voyages/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await db.delete(cruise_voyage).where(eq(cruise_voyage.id, req.params.id));
    res.status(204).send();
  })
);

export default router;
