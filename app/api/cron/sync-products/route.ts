import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { parse } from "csv-parse/sync";

import { prisma } from "@/lib/db";

// app/api/cron/sync-products/route.ts
// Next.js App Router – Node runtime recommended for CSV parsing
export const runtime = "nodejs";

type ProductData = {
  productId: number;
  subTypeName: string;
  setName: string;
  abbreviation: string;
  name: string;
  cleanName: string;
  imageUrl: string;
  url: string;
  categoryId: number | null;
  groupId: number;
  productType: string;
  rarity: string | null;
  marketPrice: number | null;
};

type Group = {
  id: number;
  groupId: number;
  name: string;
  abbreviation: string | null;
  logoImage: string | null;
  isSupplemental: boolean;
  publishedOn: Date;
  updatedAt: Date;
  lastSynced: Date | null;
  setSummarySyncedAt: Date | null;
  setEraId: number | null;
  categoryId: number;
};

// ---- Config ----
const DEFAULT_LIMIT = 20;
const DEFAULT_CATEGORY_ID = 3; // Pokemon

// TODO: Enable in production with Vercel env var
function authOK(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  // Convenience GET: returns help
  if (!authOK(req)) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ ok: true, msg: "POST to run sync" });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  // TODO: Enable in production with Vercel env var
  // if (!authOK(req)) return new NextResponse("Unauthorized", { status: 401 });

  let limit = DEFAULT_LIMIT;
  let categoryId = DEFAULT_CATEGORY_ID;

  try {
    const body = await req.json();
    if (body?.limit > 0) limit = parseInt(body.limit);
    if (body?.categoryId > 0) categoryId = parseInt(body.categoryId);
  } catch (_) {
    // no body, use defaults
  }

  const twentyFourHoursAgoISO = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  // Pull groups to process (same ordering/filters)

  const groups = await prisma.productGroup.findMany({
    where: {
      categoryId: categoryId,
      OR: [{ lastSynced: null }, { lastSynced: { lt: twentyFourHoursAgoISO } }],
    },
    orderBy: [{ lastSynced: "asc" }, { groupId: "asc" }],
    take: limit,
  });

  if (!groups.length) {
    return NextResponse.json({
      success: true,
      message: "No groups due for sync.",
      executionTime: secondsSince(start),
      summary: { groupsProcessed: 0, totalProducts: 0, groupIds: [] },
    });
  }

  let totalProducts = 0;

  for (const g of groups) {
    console.log(
      `Group to process: groupId=${g.groupId}, name=${g.name}, categoryId=${g.categoryId}, lastSynced=${g.lastSynced}`,
    );

    const { productsSynced } = await processGroup(g);
    totalProducts += productsSynced;
  }

  const groupIds = groups.map((g) => g.groupId);

  return NextResponse.json({
    success: true,
    message: `Updated ${totalProducts} records for ${groupIds.length} groups`,
    executionTime: secondsSince(start),
    summary: {
      groupsProcessed: groupIds.length,
      totalProducts,
      groupIds,
    },
  });
}

// ----------------- Helpers -----------------

async function processGroup(group: Group): Promise<{ productsSynced: number }> {
  const batchSize = 50; // Adjust based on performance testing
  let processedProducts = 0;
  try {
    const products = await fetchProductPricesCSV(group);

    console.warn(
      `Found ${products.length} products for groupId=`,
      group.groupId,
    );

    if (products.length > 0) {
      // Use batch upsert function instead of individual upserts
      const sql = neon(process.env.DATABASE_URL!);

      // Split products into batches
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        // Use the individual upsert function in a transaction for better performance
        await sql`BEGIN`;

        try {
          for (const p of batch) {
            await sql`
              SELECT upsert_tcgp_products(
                ${p.productId},
                ${p.setName},
                ${p.abbreviation}, 
                ${p.name},
                ${p.cleanName},
                ${p.imageUrl},
                ${p.url},
                ${p.marketPrice},
                ${p.subTypeName},
                ${p.productType},
                ${p.rarity},
                ${p.groupId}
              )
            `;
          }

          await sql`COMMIT`;
          processedProducts += batch.length;
          console.log(
            `Upserted batch of ${batch.length} products for group ${group.groupId}`,
          );
        } catch (error) {
          await sql`ROLLBACK`;
          throw error;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing group ${group.groupId}:`, error);
    throw error;
  } finally {
    await prisma.productGroup.update({
      where: { groupId: group.groupId },
      data: { lastSynced: new Date().toISOString() },
    });
  }

  return { productsSynced: processedProducts };
}

async function fetchProductPricesCSV(group: Group): Promise<ProductData[]> {
  const { groupId, categoryId, name: setName, abbreviation } = group;
  const url = `https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/ProductsAndPrices.csv`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV ${res.status} ${res.statusText}`);
  const text = await res.text();

  // Parse CSV in Node runtime
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const out: ProductData[] = [];
  for (const row of rows) {
    const name = row.name?.trim();
    const productIdStr = row.productId?.trim();
    const mpStr = row.marketPrice?.trim();

    if (!name || !productIdStr || !mpStr) continue;

    const productId = Number(productIdStr);
    const marketPrice = Number(mpStr);
    if (!Number.isFinite(productId) || !Number.isFinite(marketPrice)) continue;

    // Affiliate URL (kept from your original)
    const originalUrl = `https://www.tcgplayer.com/product/${productId}`;
    const url = `https://partner.tcgplayer.com/c/6110386/1830156/21018?u=${encodeURIComponent(originalUrl)}`;

    const type = getProductType(categoryId, row);

    // Skip code cards if needed
    if (type === "code") continue;

    out.push({
      productId,
      name,
      setName,
      abbreviation: abbreviation ?? "",
      cleanName: row.cleanName || "",
      imageUrl: row.imageUrl || "",
      categoryId,
      groupId,
      url,
      productType:
        type === "sealed"
          ? "sealed"
          : type === "trainer"
            ? "trainer"
            : type === "energy"
              ? "energy"
              : "card",
      rarity: row.extRarity || null,
      marketPrice,
      subTypeName: row.subTypeName || "Normal",
    });
  }

  console.log(
    `Processed ${out.length} valid products out of ${rows.length} rows`,
  );
  return out;
}

function getProductType(
  categoryId: number,
  row: Record<string, string>,
): string {
  const pokemonTrainerTypes = [
    "trainer",
    "supporter",
    "stadium",
    "item",
    "tool",
    "trainer - supporter",
    "trainer - stadium",
    "trainer - item",
    "trainer - tool",
    "trainer - pokemon tool",
  ];
  const pokemonEnergyTypes = [
    "special rainbow energy",
    "special energy",
    "basic energy",
    "energy",
  ];
  const extRarity = (row.extRarity || "").toLowerCase().trim();
  const extCardType = (row.extCardType || "").toLowerCase().trim();

  switch (categoryId) {
    case 1: // MTG (example kept from yours)
      return extRarity ? "card" : "sealed";
    default: // Pokemon (3)
      if (pokemonTrainerTypes.includes(extCardType)) return "trainer";
      if (
        (row.extHP && row.extHP !== "") ||
        (row.extNumber && row.extNumber !== "")
      )
        return "card";
      if (extRarity === "code card") return "code";
      if (
        /^basic\s+.*\s+energy$/i.test(extCardType) ||
        pokemonEnergyTypes.includes(extCardType)
      )
        return "energy";
      return "sealed";
  }
}

function secondsSince(startMs: number) {
  const ms = Date.now() - startMs;
  const s = (ms / 1000).toFixed(2);
  return { milliseconds: ms, seconds: Number(s), formatted: `${s}s` };
}

/** Example curl to POST and run sync for categoryId=3 (replace YOUR_CRON_SECRET and host as needed)

 Local:
 curl -X POST "http://localhost:3000/api/cron/sync-products?token=YOUR_CRON_SECRET" \
   -H "Content-Type: application/json" \
   -d '{"categoryId":3,"limit":20}'

   curl -X POST "http://localhost:3000/api/cron/sync-products" \
   -H "Content-Type: application/json" \
   -d '{"categoryId":3,"limit":20,"maxConcurrentGroups":1}'

 Production example:
  curl -X POST "https://your-domain.com/api/cron/sync-products?token=YOUR_CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"categoryId":3}'
*/
