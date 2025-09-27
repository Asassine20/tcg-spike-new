import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";

const TCGPLAYER_API_VERSION = "v1.39.0"; // Or your desired TCGPlayer API version

interface TCGPlayerGroup {
  groupId: number;
  name: string;
  abbreviation: string | null;
  isSupplemental: boolean;
  publishedOn: string;
  modifiedOn: string;
  categoryId: number; // We'll add this manually after fetching
}

interface TCGPlayerGroupsResponse {
  totalItems: number;
  success: boolean;
  errors: string[];
  results: Omit<TCGPlayerGroup, "categoryId">[]; // categoryId is not in this specific API response
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

async function getCategoryIds(): Promise<number[]> {
  console.log("Fetching category IDs from database...");

  try {
    const categories = await prisma.productCategory.findMany({
      select: {
        categoryId: true,
      },
    });

    if (categories.length === 0) {
      console.log("No category_ids found in database.");
      return [];
    }

    const categoryIds = categories.map((cat) => cat.categoryId);
    console.log(`Found ${categoryIds.length} category IDs in database.`);
    return categoryIds;
  } catch (error) {
    console.error("Error fetching category_ids from database:", error);
    throw new Error(
      `Database error fetching category_ids: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function fetchAllGroupsFromTCGPlayer(
  token: string,
  categoryIds: number[],
): Promise<TCGPlayerGroup[]> {
  let allGroups: TCGPlayerGroup[] = [];
  const limit = 100; // TCGPlayer API max limit per request
  const maxAttempts = 3;

  console.log(
    `Starting to fetch groups for ${categoryIds.length} categories from TCGPlayer...`,
  );

  for (const categoryId of categoryIds) {
    let offset = 0;
    let totalItemsForCategory = 0;
    console.log(`Fetching groups for category ID: ${categoryId}`);

    do {
      const url = `https://api.tcgplayer.com/${TCGPLAYER_API_VERSION}/catalog/categories/${categoryId}/groups?offset=${offset}&limit=${limit}`;
      console.log(`Fetching groups: ${url}`);

      let currentPageData: TCGPlayerGroupsResponse | null = null;
      for (let attempts = 0; attempts < maxAttempts; attempts++) {
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
              `Failed to fetch groups page (category: ${categoryId}, offset: ${offset}): ${response.status} ${response.statusText}`,
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
            if (response.status === 404 && offset === 0) {
              // No groups for this category
              console.log(
                `No groups found for category ${categoryId} (404). Skipping.`,
              );
              currentPageData = {
                totalItems: 0,
                success: true,
                errors: [],
                results: [],
              }; // Simulate empty success
              break;
            }
            throw new Error(
              `Failed to fetch groups page: ${response.statusText}`,
            );
          }
          currentPageData = (await response.json()) as TCGPlayerGroupsResponse;
          break; // Success, exit retry loop
        } catch (pageError) {
          console.error(
            `Error fetching groups for category ${categoryId} at offset ${offset}, attempt ${attempts + 1}:`,
            pageError,
          );
          if (attempts + 1 >= maxAttempts) {
            // Log and continue to next category or offset if possible, instead of failing all.
            console.error(
              `Max attempts reached for category ${categoryId}, offset ${offset}. Skipping this page.`,
            );
            currentPageData = null; // Ensure we don't process partial bad data
            break;
          }
          await delay(5000 * (attempts + 1)); // Exponential backoff
        }
      }

      if (!currentPageData || !currentPageData.success) {
        console.error(
          `Failed to fetch groups for category ${categoryId} or API call was not successful:`,
          currentPageData?.errors,
        );
        // Decide if you want to throw and stop all, or log and continue with next category
        // For now, let's skip this category's current page if it fails after retries
        console.warn(
          `Skipping current page for category ${categoryId} due to API error or failure after retries.`,
        );
        offset += limit; // Try to move to next page or finish category
        if (currentPageData?.totalItems)
          totalItemsForCategory = currentPageData.totalItems; // update total if available
        else if (offset === 0) totalItemsForCategory = 0; // If first page fails hard, assume no items
        continue;
      }

      const groupsWithCategoryId = currentPageData.results.map((group) => ({
        ...group,
        categoryId: categoryId, // Manually add categoryId
      }));

      allGroups = allGroups.concat(groupsWithCategoryId);
      totalItemsForCategory = currentPageData.totalItems;
      offset += limit;

      console.log(
        `Fetched ${currentPageData.results.length} groups for category ${categoryId}. Total fetched for this category so far: ${offset > totalItemsForCategory ? totalItemsForCategory : offset}. Total available for category: ${totalItemsForCategory}.`,
      );
      console.log(
        `Total groups fetched across all categories: ${allGroups.length}`,
      );

      if (offset < totalItemsForCategory) {
        await delay(1000); // 1-second delay between page requests for the same category
      }
    } while (offset < totalItemsForCategory);

    console.log(
      `Finished fetching groups for category ID: ${categoryId}. Total for this category: ${totalItemsForCategory}`,
    );
    await delay(2000); // 2-second delay between different categories
  }

  console.log(
    `Successfully fetched a total of ${allGroups.length} groups across all categories.`,
  );
  return allGroups;
}

async function syncGroupsToDatabase(groups: TCGPlayerGroup[]) {
  if (!groups || groups.length === 0) {
    console.log("No groups to sync.");
    return { syncedCount: 0, errors: [] };
  }

  console.log(`Attempting to sync ${groups.length} groups to Supabase...`);

  const groupsToUpsert = groups.map((tcgGroup) => ({
    group_id: tcgGroup.groupId,
    category_id: tcgGroup.categoryId,
    name: tcgGroup.name,
    abbreviation: tcgGroup.abbreviation,
    is_supplemental: tcgGroup.isSupplemental,
    published_on: tcgGroup.publishedOn,
    last_synced: new Date().toISOString(),
  }));

  let overallSyncedCount = 0;
  const allErrors: Error[] = [];

  // Upsert each group sequentially so we can await the prisma call and handle per-item errors.
  for (const g of groupsToUpsert) {
    console.log(`Upserting group: ${g.name} (groupId=${g.group_id})`);
    try {
      const productGroup = await prisma.productGroup.upsert({
        where: { groupId: g.group_id },
        create: {
          groupId: g.group_id,
          categoryId: g.category_id,
          name: g.name,
          abbreviation: g.abbreviation,
          isSupplemental: g.is_supplemental,
          publishedOn: g.published_on ? new Date(g.published_on) : undefined,
          lastSynced: g.last_synced ? new Date(g.last_synced) : new Date(),
        },
        update: {
          categoryId: g.category_id,
          name: g.name,
          abbreviation: g.abbreviation,
          isSupplemental: g.is_supplemental,
          lastSynced: g.last_synced ? new Date(g.last_synced) : new Date(),
        },
      });

      if (productGroup) {
        overallSyncedCount += 1;
      }
    } catch (upsertErr) {
      console.error(
        `Error upserting group ${g.name} (groupId=${g.group_id}):`,
        upsertErr,
      );
      allErrors.push(
        upsertErr instanceof Error ? upsertErr : new Error(String(upsertErr)),
      );
    }
  }

  if (allErrors.length > 0) {
    console.error(
      `Database upsert finished with ${allErrors.length} item errors.`,
    );
  }

  console.log(
    `Successfully processed. Attempted to sync/update ${overallSyncedCount} groups in Supabase.`,
  );
  return { syncedCount: overallSyncedCount, errors: allErrors };
}

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tcgPlayerClientId = process.env.TCGPLAYER_PUBLIC_KEY;
    const tcgPlayerClientSecret = process.env.TCGPLAYER_PRIVATE_KEY;

    if (!tcgPlayerClientId || !tcgPlayerClientSecret) {
      throw new Error(
        "TCGPlayer API credentials are not set in environment variables.",
      );
    }

    // Safely extract category IDs from the request body if present
    let categoryIds: number[] = [3]; // Default to category ID 3 if not provided
    try {
      const body = await req.text();
      if (body) {
        const parsed = JSON.parse(body);
        categoryIds = Array.isArray(parsed.categoryIds)
          ? parsed.categoryIds
          : []; // Default to category ID 3 if not provided
      }
    } catch (parseError) {
      console.error("Error parsing JSON body:", parseError);
    }

    const tcgPlayerToken = await fetchTCGPlayerToken(
      tcgPlayerClientId,
      tcgPlayerClientSecret,
    );

    if (categoryIds.length === 0) {
      console.log(
        "No category IDs provided in the request. Fetching from database...",
      );
      categoryIds = await getCategoryIds();

      if (categoryIds.length === 0) {
        console.log("No categories found in database to fetch groups for.");
        return new Response(
          JSON.stringify({
            message: "No categories in DB to process.",
            syncedCount: 0,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    const groups = await fetchAllGroupsFromTCGPlayer(
      tcgPlayerToken,
      categoryIds,
    );

    const syncResult = await syncGroupsToDatabase(
      groups.filter(
        (group) =>
          !GROUPS_TO_NOT_SYNC.some(
            (excluded) => excluded.groupId === group.groupId,
          ),
      ),
    );

    // Calculate execution time
    const endTime = performance.now();
    const executionTimeMs = endTime - startTime;
    const executionTimeSeconds = (executionTimeMs / 1000).toFixed(2);

    return new Response(
      JSON.stringify({
        message: "Groups sync process completed!",
        syncedCount: syncResult.syncedCount,
        errorsCount: syncResult.errors.length,
        seconds: parseFloat(executionTimeSeconds),
        formatted: `${executionTimeSeconds}s`,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error in sync-groups function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// Exclude these groups from syncing since TCGPlayer doesn't provide correct information
const GROUPS_TO_NOT_SYNC = [
  {
    groupId: 1542,
    name: "EX Trainer Kit 2: Plusle & Minun",
    abbreviation: "PR",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.2926813Z",
    modifiedOn: "2024-05-03T19:42:49.017",
    categoryId: 3,
  },
  {
    groupId: 1423,
    name: "Nintendo Promos",
    abbreviation: "PR",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.2926813Z",
    modifiedOn: "2024-08-28T16:26:10.73",
    categoryId: 3,
  },
  {
    groupId: 1422,
    name: "POP Series 1",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.2926813Z",
    modifiedOn: "2025-03-17T17:09:52.317",
    categoryId: 3,
  },
  {
    groupId: 1447,
    name: "POP Series 2",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.2926813Z",
    modifiedOn: "2024-11-11T13:40:36.19",
    categoryId: 3,
  },
  {
    groupId: 1442,
    name: "POP Series 3",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.2926813Z",
    modifiedOn: "2022-10-25T17:28:02.897",
    categoryId: 3,
  },
  {
    groupId: 1452,
    name: "POP Series 4",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.2926813Z",
    modifiedOn: "2023-02-01T15:02:28.727",
    categoryId: 3,
  },
  {
    groupId: 1439,
    name: "POP Series 5",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.3551689Z",
    modifiedOn: "2024-03-23T21:26:09.477",
    categoryId: 3,
  },
  {
    groupId: 1432,
    name: "POP Series 6",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.3707917Z",
    modifiedOn: "2024-02-21T13:38:42.5",
    categoryId: 3,
  },
  {
    groupId: 1414,
    name: "POP Series 7",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.3707917Z",
    modifiedOn: "2025-01-08T07:03:26.94",
    categoryId: 3,
  },
  {
    groupId: 1450,
    name: "POP Series 8",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.3707917Z",
    modifiedOn: "2025-02-25T12:13:14.7",
    categoryId: 3,
  },
  {
    groupId: 1446,
    name: "POP Series 9",
    abbreviation: "POP",
    isSupplemental: false,
    publishedOn: "2025-07-18T20:00:06.3707917Z",
    modifiedOn: "2023-02-01T18:34:12.12",
    categoryId: 3,
  },
];

/* To invoke locally:

  curl -X POST "http://localhost:3000/api/cron/sync-groups" \
   -H "Content-Type: application/json"

*/
