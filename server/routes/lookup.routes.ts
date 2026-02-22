import { Router } from "express";
import { db } from "../config/database";
import {
  country,
  destination,
  resorts,
  accomodation_list,
  accomodation_type,
  board_basis,
  park,
  lodges,
  cottages,
  package_type,
  room_type,
  accommodation_images,
  lodge_images,
  cruise_line,
  cruise_ship,
  cruise_itenary,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/countries", async (_req, res) => {
  try {
    const rows = await db.select().from(country).orderBy(country.country_name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/destinations", async (req, res) => {
  try {
    const countryId = req.query.countryId as string | undefined;
    let query = db.select().from(destination);
    if (countryId) {
      query = query.where(eq(destination.country_id, countryId)) as any;
    }
    const rows = await query.orderBy(destination.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/resorts", async (req, res) => {
  try {
    const destinationId = req.query.destinationId as string | undefined;
    let query = db.select().from(resorts);
    if (destinationId) {
      query = query.where(eq(resorts.destination_id, destinationId)) as any;
    }
    const rows = await query.orderBy(resorts.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/accommodations", async (req, res) => {
  try {
    const resortId = req.query.resortId as string | undefined;
    let query = db.select().from(accomodation_list);
    if (resortId) {
      query = query.where(eq(accomodation_list.resorts_id, resortId)) as any;
    }
    const rows = await query.orderBy(accomodation_list.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/board-basis", async (_req, res) => {
  try {
    const rows = await db.select().from(board_basis).orderBy(board_basis.type);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/parks", async (req, res) => {
  try {
    const parkId = req.query.parkId as string | undefined;
    let query = db.select().from(park);
    if (parkId) {
      query = query.where(eq(park.id, parkId)) as any;
    }
    const rows = await query.orderBy(park.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/lodges", async (req, res) => {
  try {
    const parkId = req.query.parkId as string | undefined;
    let query = db.select().from(lodges);
    if (parkId) {
      query = query.where(eq(lodges.park_id, parkId)) as any;
    }
    const rows = await query.orderBy(lodges.lodge_name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/package-types", async (_req, res) => {
  try {
    const allowedNames = ["Package Holiday", "Cruise Package", "Hot Tub Break", "Others"];
    const rows = await db.select().from(package_type).orderBy(package_type.name);
    const filtered = rows.filter((r) => allowedNames.includes(r.name));
    res.json({ success: true, data: filtered });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/accommodation-types", async (_req, res) => {
  try {
    const rows = await db.select().from(accomodation_type).orderBy(accomodation_type.type);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/cottages", async (_req, res) => {
  try {
    const rows = await db.select().from(cottages).orderBy(cottages.cottage_name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/room-types", async (_req, res) => {
  try {
    const rows = await db.select().from(room_type).orderBy(room_type.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/accommodation-images", async (req, res) => {
  try {
    const accommodationId = req.query.accommodationId as string | undefined;
    if (!accommodationId) return res.json({ success: true, data: [] });
    const rows = await db.select().from(accommodation_images).where(eq(accommodation_images.accommodation_id, accommodationId));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/lodge-images", async (req, res) => {
  try {
    const lodgeId = req.query.lodgeId as string | undefined;
    if (!lodgeId) return res.json({ success: true, data: [] });
    const rows = await db.select().from(lodge_images).where(eq(lodge_images.lodge_id, lodgeId));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/cruise-lines", async (_req, res) => {
  try {
    const rows = await db.select().from(cruise_line).orderBy(cruise_line.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/ships", async (req, res) => {
  try {
    const cruiseLineId = req.query.cruiseLineId as string | undefined;
    let query = db.select().from(cruise_ship);
    if (cruiseLineId) {
      query = query.where(eq(cruise_ship.cruise_line_id, cruiseLineId)) as any;
    }
    const rows = await query.orderBy(cruise_ship.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/cruise-itineraries", async (req, res) => {
  try {
    const shipId = req.query.shipId as string | undefined;
    if (!shipId) return res.json({ success: true, data: [] });
    const rows = await db.select().from(cruise_itenary).where(eq(cruise_itenary.ship_id, shipId)).orderBy(cruise_itenary.date);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
