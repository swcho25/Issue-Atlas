import { z } from "zod";

import { id, schemaVersion } from "./common";

// GET /v1/places/{place_id}/boundaries 응답(contracts/c2/schemas/place-boundaries.schema.json, c2-0.1).
// GeoJSON FeatureCollection(WGS84 [경도, 위도]). 시군구를 주면 시군구 경계가 먼저, 이어서 그 안 행정동
const position = z.tuple([z.number().min(124).max(132), z.number().min(33).max(39)]);

const feature = z.object({
  type: z.literal("Feature"),
  id,
  geometry: z.object({
    type: z.literal("MultiPolygon"),
    // 다각형들 → 고리들(바깥 + 구멍) → 점들(닫힌 고리라 4개 이상)
    coordinates: z.array(z.array(z.array(position).min(4)).min(1)).min(1),
  }),
  properties: z.object({
    place_id: id,
    name: z.string(),
    level: z.enum(["sigungu", "emd"]),
    parent_id: z.string().nullable(),
    source: z.literal("sgis_hadmarea"),
    source_year: z.number().int(),
  }),
});

export const placeBoundariesSchema = z.object({
  schema_version: schemaVersion,
  type: z.literal("FeatureCollection"),
  features: z.array(feature),
});

export type PlaceBoundaries = z.infer<typeof placeBoundariesSchema>;
