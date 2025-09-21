import { unstable_cache } from "next/cache";
import type { Product } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "@/lib/db";
import { tcgTypeOptions } from "@/app/(protected)/_lib/constants/filter-option-constants";

// DTO with decimals converted to numbers for JSON/client usage
export type ProductDTO = Omit<
  Product,
  | "marketPrice"
  | "prevMarketPrice"
  | "diffMarketPrice"
  | "dollarDiffMarketPrice"
> & {
  marketPrice: number | null;
  prevMarketPrice: number | null;
  diffMarketPrice: number | null;
  dollarDiffMarketPrice: number | null;
};

export interface LoadProductsResult {
  canAccessCompetitive: boolean;
  products: ProductDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface LoadProductsProps {
  selectedCategoryId: number;
  selectedGroupIds?: number[];
  pageSize: number;
  page: number;
  priceRange: string | null;
  rarities: string[];
  searchTerm: string | null;
  sortColumn: string;
  sortDirection: string;
  productType: string[];
}

// Adjusted signature to return LoadProductsResult
async function fetchProducts({
  selectedCategoryId = 3,
  selectedGroupIds = [],
  pageSize = 20,
  page = 1,
  priceRange,
  rarities = [],
  searchTerm,
  sortColumn = "market_price",
  sortDirection = "desc",
  productType = ["card", "sealed"],
}: LoadProductsProps): Promise<LoadProductsResult> {
  try {
    // Validate sort column to prevent SQL injection
    const validSortColumns = [
      "name",
      "setName",
      "marketPrice",
      "prevMarketPrice",
      "diffMarketPrice",
      "dollarDiffMarketPrice",
      "updatedAt",
      // Also allow snake_case for compatibility
      "set_name",
      "market_price",
      "prev_market_price",
      "diff_market_price",
      "dollar_diff_market_price",
      "updated_at",
    ];

    // Validate product type
    const validProductTypes = Object.values(tcgTypeOptions)
      .flat()
      .map((option) => option.value);
    if (productType.some((pt) => !validProductTypes.includes(pt))) {
      throw new Error(
        `Invalid product type provided in ${productType.join(", ")}`,
      );
    }

    const actualSortColumn = validSortColumns.includes(sortColumn)
      ? sortColumn
      : "marketPrice";

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Build Prisma where clause
    const whereClause: any = {
      // Filter by category through the group relation
      group: {
        categoryId: selectedCategoryId,
      },
    };

    // Apply filters
    if (productType.length > 0) {
      whereClause.productType = {
        in: productType,
      };
    }

    if (rarities.length > 0) {
      whereClause.rarity = {
        in: rarities,
      };
    }

    if (searchTerm) {
      whereClause.name = {
        contains: searchTerm,
        mode: "insensitive", // Case-insensitive search
      };
    }

    if (selectedGroupIds.length > 0) {
      whereClause.groupId = {
        in: selectedGroupIds,
      };
    }

    // Apply price range filter if provided
    if (priceRange) {
      if (priceRange === "0-5") {
        whereClause.marketPrice = {
          gte: 0,
          lt: 5,
        };
      } else if (priceRange === "5-20") {
        whereClause.marketPrice = {
          gte: 5,
          lt: 20,
        };
      } else if (priceRange === "20+") {
        whereClause.marketPrice = {
          gte: 20,
        };
      }
    }

    // Add filtering for null values based on sort column
    if (
      [
        "marketPrice",
        "prevMarketPrice",
        "diffMarketPrice",
        "dollarDiffMarketPrice",
      ].includes(actualSortColumn) &&
      sortDirection === "desc"
    ) {
      // When sorting by price in descending order, exclude null values
      whereClause[actualSortColumn] = {
        ...whereClause[actualSortColumn],
        not: null,
      };
    }

    // Build orderBy clause - convert snake_case to camelCase
    const sortColumnMap: Record<string, string> = {
      market_price: "marketPrice",
      prev_market_price: "prevMarketPrice",
      diff_market_price: "diffMarketPrice",
      dollar_diff_market_price: "dollarDiffMarketPrice",
      updated_at: "updatedAt",
      set_name: "setName",
      name: "name",
    };

    const prismaOrderBy = {
      [sortColumnMap[actualSortColumn] || actualSortColumn]: sortDirection,
    };

    // Execute Prisma queries
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: prismaOrderBy,
        skip,
        take,
        include: {
          group: {
            select: {
              groupId: true,
              name: true,
              categoryId: true,
            },
          },
        },
      }),
      prisma.product.count({
        where: whereClause,
      }),
    ]);

    // Convert Decimal fields to numbers (or keep as strings if you need exact precision)
    const serializedProducts = products.map((p) => ({
      ...p,
      marketPrice:
        p.marketPrice !== null
          ? Number(p.marketPrice as unknown as string)
          : null,
      prevMarketPrice:
        p.prevMarketPrice !== null
          ? Number(p.prevMarketPrice as unknown as string)
          : null,
      diffMarketPrice:
        p.diffMarketPrice !== null
          ? Number(p.diffMarketPrice as unknown as string)
          : null,
      dollarDiffMarketPrice:
        p.dollarDiffMarketPrice !== null
          ? Number(p.dollarDiffMarketPrice as unknown as string)
          : null,
    }));
    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      products: serializedProducts ?? [],
      totalCount: totalCount ?? 0,
      page,
      pageSize,
      totalPages,
      canAccessCompetitive: true,
    };
  } catch (error) {
    console.error("Unexpected error:", error);
    throw new Error("Internal server error");
  }
}

// Conditional export: disable unstable_cache in development
declare const process: { env: { NODE_ENV: string } };

export const loadProducts =
  process.env.NODE_ENV === "development"
    ? fetchProducts
    : unstable_cache(fetchProducts, ["products"], {
        revalidate: 3600,
        tags: ["products"],
      });
