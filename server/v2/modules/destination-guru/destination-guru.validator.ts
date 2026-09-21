import { z } from "zod";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Route-level `:id` guard — used directly on GET /:id and DELETE /:id, and
// reused (via idParamSchema) inside updateCoordinatesValidator's params.
export const idParamValidator = z.object({
  params: idParamSchema,
});

const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);

// (0, 0) is the classic "unset" sentinel (Null Island) rather than a real
// destination centre — rejected everywhere a coordinate pair is accepted.
const NULL_ISLAND_MESSAGE = "Coordinates (0, 0) are not a valid destination location";
const isNullIsland = (lat: number, lng: number) => lat === 0 && lng === 0;

// Shared shape for a lat/lng pair — used to validate the AI's own
// "coordinates" field.
export const coordinatesSchema = z
  .object({
    lat: latitudeSchema,
    lng: longitudeSchema,
  })
  .refine((c) => !isNullIsland(c.lat, c.lng), { message: NULL_ISLAND_MESSAGE });

export const generateDestinationGuruValidator = z.object({
  body: z.object({
    destination: z
      .string()
      .trim()
      .min(1, "Destination is required")
      .max(200, "Destination is too long"),
  }),
});

export const updateCoordinatesValidator = z.object({
  params: idParamSchema,
  body: z
    .object({
      latitude: latitudeSchema,
      longitude: longitudeSchema,
    })
    .refine((b) => !isNullIsland(b.latitude, b.longitude), { message: NULL_ISLAND_MESSAGE }),
});
