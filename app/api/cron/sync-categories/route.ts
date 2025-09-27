import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { parse } from "csv-parse/sync";

const TCGPLAYER_API_VERSION = "v1.39.0";

interface TCGPlayerCategory {
  categoryId: number;
  displayName: string;
  name: string;
  modifiedOn: string;
  seoCategoryName: string;
}

interface TCGPlayerCategoriesResponse {
  totalItems: number;
  success: boolean;
  errors: string[];
  results: TCGPlayerCategory[];
}

/**
 * Fetches a bearer token from TCGPlayer API
 */
async function fetchTCGPlayerToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  try {
    const response = await fetch("https://api.tcgplayer.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Failed to fetch token: ${response.status} ${response.statusText}`,
        errorBody,
      );
      throw new Error(`Failed to fetch token: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error("No access token returned from TCGPlayer API");
    }

    console.log("Successfully retrieved TCGPlayer API token");
    return data.access_token;
  } catch (error) {
    console.error("Error fetching TCGPlayer token:", error);
    throw error; // Re-throw to be caught by the main handler
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAllCategoriesFromTCGPlayer(
  token: string,
  categoryIds: number[] | undefined,
): Promise<TCGPlayerCategory[]> {
  let allCategories: TCGPlayerCategory[] = [];
  let offset = 0;
  const limit = 100;
  let totalItems = 0;
  let attempts = 0;
  const maxAttempts = 3;

  console.log("Starting to fetch categories from TCGPlayer...");

  do {
    const url = `https://api.tcgplayer.com/${TCGPLAYER_API_VERSION}/catalog/categories?offset=${offset}&limit=${limit}`;
    console.log(`Fetching categories: ${url}`);

    let currentPageData: TCGPlayerCategoriesResponse | null = null;
    for (attempts = 0; attempts < maxAttempts; attempts++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(
            `Failed to fetch categories page (offset: ${offset}): ${response.status} ${response.statusText}`,
            errorBody,
          );
          if (response.status === 429) {
            // Too Many Requests
            console.log(
              `Rate limited. Waiting for 60 seconds... Attempt ${attempts + 1}`,
            );
            await delay(60000); // Wait 60 seconds
            continue; // Retry the same page
          }
          throw new Error(
            `Failed to fetch categories page: ${response.statusText}`,
          );
        }
        currentPageData =
          (await response.json()) as TCGPlayerCategoriesResponse;
        break; // Success, exit retry loop
      } catch (pageError) {
        console.error(
          `Error fetching page at offset ${offset}, attempt ${attempts + 1}:`,
          pageError,
        );
        if (attempts + 1 >= maxAttempts) {
          throw pageError; // Max attempts reached, re-throw
        }
        await delay(5000 * (attempts + 1)); // Exponential backoff
      }
    }

    if (!currentPageData || !currentPageData.success) {
      console.error(
        "Failed to fetch categories or API call was not successful:",
        currentPageData?.errors,
      );
      throw new Error(
        `TCGPlayer API error: ${currentPageData?.errors?.join(", ")}`,
      );
    }

    allCategories = allCategories.concat(currentPageData.results);
    totalItems = currentPageData.totalItems;
    offset += limit;

    console.log(
      `Fetched ${currentPageData.results.length} categories. Total fetched so far: ${allCategories.length}. Total available: ${totalItems}`,
    );

    if (offset < totalItems) {
      await delay(1000); // 1-second delay between page requests to be respectful to the API
    }
  } while (offset < totalItems);

  if (categoryIds) {
    allCategories = allCategories.filter((category) =>
      categoryIds.includes(category.categoryId),
    );
    console.log(
      `Filtered categories to only include specified IDs. Total categories after filtering: ${allCategories.length}.`,
    );
  }

  console.log(`Successfully fetched all ${allCategories.length} categories.`);
  return allCategories;
}

async function syncCategoriesToDatabase(categories: TCGPlayerCategory[]) {
  if (!categories || categories.length === 0) {
    console.log("No categories to sync.");
    return { syncedCount: 0, errors: [] };
  }

  console.log(
    `Attempting to sync ${categories.length} categories to database...`,
  );

  const sql = neon(process.env.DATABASE_URL!);

  for (const category of categories) {
    await sql`
        INSERT INTO tcgp_categories (
          category_id, name, display_name, seo_category_name, updated_at
        ) 
        VALUES (
          ${category.categoryId}, ${category.name}, ${category.displayName}, 
          ${category.seoCategoryName}, NOW()
        )
        ON CONFLICT (category_id) 
        DO UPDATE SET
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          seo_category_name = EXCLUDED.seo_category_name,
          updated_at = NOW()
      `;
  }

  // The 'data' returned by upsert might be null or an array depending on 'select' and version.
  // For bulk upserts, checking the error is usually the primary concern.
  // If you need to count, you might infer from the input length if no error.
  console.log(
    `Successfully synced/updated ${categories.length} categories in Supabase.`,
  );
  return { syncedCount: categories.length, errors: [] }; // Assuming all were processed if no error
}

// TODO: Enable in production with Vercel env var
function authOK(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  // Convenience GET: returns help
  if (!authOK(req)) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ ok: true, msg: "METHOD Not Allowed" });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  // TODO: Enable in production with Vercel env var
  // if (!authOK(req)) return new NextResponse("Unauthorized", { status: 401 });

  // Parse request body to get category IDs
  let requestBody: { categoryIds?: number[] } = {};
  try {
    const bodyText = await req.text();
    if (bodyText) {
      requestBody = JSON.parse(bodyText);
    }
  } catch (_error) {
    console.log("No valid JSON body provided, will sync all categories");
  }

  const tcgPlayerClientId = process.env.TCGPLAYER_PUBLIC_KEY;
  const tcgPlayerClientSecret = process.env.TCGPLAYER_PRIVATE_KEY;
  const categoryIds = requestBody.categoryIds;

  if (!tcgPlayerClientId || !tcgPlayerClientSecret) {
    throw new Error(
      "TCGPlayer API credentials are not set in environment variables.",
    );
  }

  try {
    const tcgPlayerToken = await fetchTCGPlayerToken(
      tcgPlayerClientId,
      tcgPlayerClientSecret,
    );
    const categories = await fetchAllCategoriesFromTCGPlayer(
      tcgPlayerToken,
      categoryIds,
    );
    await syncCategoriesToDatabase(categories);
    const end = Date.now();
    console.log(
      `Category sync process completed in ${(end - start) / 1000} seconds.`,
    );
    const syncResult = { syncedCount: categories.length };

    return new Response(
      JSON.stringify({
        message: "Categories synced successfully!",
        syncedCount: syncResult.syncedCount,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error in sync-categories function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

/** Example curl to POST and run sync for categoryId=3 (replace YOUR_CRON_SECRET and host as needed)

 Local:
 curl -X POST "http://localhost:3000/api/cron/sync-categories" \
   -H "Content-Type: application/json"

   curl -X POST "http://localhost:3000/api/cron/sync-products" \
   -H "Content-Type: application/json" \
   -d '{"categoryId":3,"limit":20,"maxConcurrentGroups":1}'

 Production example:
  curl -X POST "https://your-domain.com/api/cron/sync-products?token=YOUR_CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"categoryId":3}'
*/
