import { NextResponse } from "next/server";
import { auth } from "@/auth";

import { prisma } from "@/lib/db";

import { loadProducts, LoadProductsProps } from "../_lib/load-products";

export const GET = auth(async (req) => {
  if (!req.auth) {
    return new Response("Not authenticated", { status: 401 });
  }

  const currentUser = req.auth.user;
  if (!currentUser) {
    return new Response("Invalid user", { status: 401 });
  }

  // TODO: re-enable entitlements
  // const entitlementService = createEntitlementsService(
  //   supabase,
  //   currentUser.id,
  // );
  // const canAccessTrends = await entitlementService.canUseFeature("trends");

  // if (!canAccessTrends) {
  //   const totalCards = 12; // Dummy total count for pagination
  //   const result = {
  //     canAccessCompetitive: false,
  //     cards: createDummyCards(totalCards),
  //     totalPages: 1,
  //     totalCount: totalCards,
  //   };
  //   // Merge 'result' into the first argument (body)
  //   return NextResponse.json(
  //     {
  //       error: "Access to competitive features is not allowed",
  //       ...result, // Spread the result object here
  //     },
  //     { status: 403 },
  //   );
  // }

  const { searchParams } = req.nextUrl;

  try {
    const props: LoadProductsProps = {
      selectedCategoryId: Number(searchParams.get("category") || "3"),
      selectedGroupIds: searchParams.has("groups")
        ? searchParams.get("groups")!.split(",").map(Number)
        : [],
      pageSize: Number(searchParams.get("limit") || "20"),
      page: Number(searchParams.get("page") || "1"),
      priceRange: searchParams.get("price") || null,
      rarities: searchParams.has("rarity")
        ? searchParams.get("rarity")!.split(",")
        : [],
      searchTerm: searchParams.get("q") || null,
      sortColumn: searchParams.get("sort_by") || "market_price",
      sortDirection: searchParams.get("sort_dir") || "desc",
      productType: searchParams.has("type")
        ? searchParams.get("type")!.split(",")
        : ["card"],
    };

    const result = await loadProducts(props);
    // result.canAccessCompetitive = canAccessTrends;
    return NextResponse.json(result);
  } catch (error) {
    console.error("API route error:", error);
    // It's good practice to not expose raw error messages to the client
    // Consider a more generic error message for production
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: "Failed to load products", details: errorMessage },
      { status: 500 },
    );
  }
});
