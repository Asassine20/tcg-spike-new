import { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "@/lib/db";

export interface WeeklyPriceTrendOptions {
  categoryId?: number;
  groupId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface WeeklyPriceTrend {
  productId: number;
  subTypeName: string | null;
  currentAvgPrice: number;
  prevAvgPrice: number;
  weeklyChange: number | null;
  weeklyDollarChange: number;
  minPrice: number | null;
  maxPrice: number | null;
  observationCount: number;
  product?: {
    id: number;
    productId: number;
    name: string | null;
    cleanName: string | null;
    imageUrl: string | null;
    url: string | null;
    setName: string | null;
    abbreviation: string | null;
    rarity: string | null;
    productType: string | null;
    group: {
      id: number;
      groupId: number;
      name: string;
      abbreviation: string | null;
      category: {
        id: number;
        categoryId: number;
        name: string;
        displayName: string;
      };
    } | null;
  } | null;
}

function decimalToNumber(decimal: Decimal | null): number {
  return decimal?.toNumber() || 0;
}

export async function getWeeklyPriceTrends(
  options: WeeklyPriceTrendOptions = {},
): Promise<WeeklyPriceTrend[]> {
  const { categoryId, groupId, limit = 50 } = options;

  // Get current week's date range (Sunday to Saturday)
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay()); // Go to Sunday
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6); // Go to Saturday
  currentWeekEnd.setHours(23, 59, 59, 999);

  // Previous week
  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const prevWeekEnd = new Date(currentWeekEnd);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

  // Build where clause for filtering
  const baseWhereClause = {
    product: {
      ...(categoryId && { group: { categoryId } }),
      ...(groupId && { groupId }),
    },
  };

  try {
    // Get current week data
    const currentWeekData = await prisma.priceHistory.groupBy({
      by: ["productId", "subTypeName"],
      where: {
        ...baseWhereClause,
        priceDate: {
          gte: currentWeekStart,
          lte: currentWeekEnd,
        },
        marketPrice: {
          not: null,
        },
      },
      _avg: { marketPrice: true },
      _min: { marketPrice: true },
      _max: { marketPrice: true },
      _count: { marketPrice: true },
    });

    // Get previous week data for comparison
    const prevWeekData = await prisma.priceHistory.groupBy({
      by: ["productId", "subTypeName"],
      where: {
        ...baseWhereClause,
        priceDate: {
          gte: prevWeekStart,
          lte: prevWeekEnd,
        },
        marketPrice: {
          not: null,
        },
      },
      _avg: { marketPrice: true },
    });

    // Create a map for quick lookup of previous week data
    const prevWeekMap = new Map<string, number>();
    prevWeekData.forEach((prev) => {
      const key = `${prev.productId}-${prev.subTypeName || "null"}`;
      const avgPrice = decimalToNumber(prev._avg.marketPrice);
      if (avgPrice > 0) {
        prevWeekMap.set(key, avgPrice);
      }
    });

    // Combine and calculate trends
    const trends: WeeklyPriceTrend[] = currentWeekData.map((current) => {
      const key = `${current.productId}-${current.subTypeName || "null"}`;
      const currentAvg = decimalToNumber(current._avg.marketPrice);
      const prevAvg = prevWeekMap.get(key) || 0;

      let weeklyChange: number | null = null;
      if (prevAvg > 0) {
        weeklyChange = (currentAvg - prevAvg) / prevAvg;
      }

      return {
        productId: current.productId,
        subTypeName: current.subTypeName,
        currentAvgPrice: currentAvg,
        prevAvgPrice: prevAvg,
        weeklyChange,
        weeklyDollarChange: currentAvg - prevAvg,
        minPrice: decimalToNumber(current._min.marketPrice),
        maxPrice: decimalToNumber(current._max.marketPrice),
        observationCount: current._count.marketPrice,
      };
    });

    // Sort by biggest percentage movers (absolute value)
    const sortedTrends = trends
      .filter((trend) => trend.currentAvgPrice > 0) // Only include products with current prices
      .sort((a, b) => {
        const aChange = Math.abs(a.weeklyChange || 0);
        const bChange = Math.abs(b.weeklyChange || 0);
        return bChange - aChange;
      })
      .slice(0, limit);

    // Get product details for the top movers
    const productsWithTrends = await Promise.all(
      sortedTrends.map(async (trend) => {
        try {
          const product = await prisma.product.findFirst({
            where: {
              productId: trend.productId,
              subTypeName: trend.subTypeName,
            },
            include: {
              group: {
                include: {
                  category: {
                    select: {
                      id: true,
                      categoryId: true,
                      name: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          });

          return { ...trend, product };
        } catch (error) {
          console.error(`Error fetching product ${trend.productId}:`, error);
          return { ...trend, product: null };
        }
      }),
    );

    return productsWithTrends;
  } catch (error) {
    console.error("Error in getWeeklyPriceTrends:", error);
    throw new Error("Failed to fetch weekly price trends");
  }
}

export async function getDailyPriceTrends(
  options: WeeklyPriceTrendOptions = {},
): Promise<WeeklyPriceTrend[]> {
  const { categoryId, groupId, limit = 50 } = options;

  // Get today and yesterday
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);

  // Build where clause for filtering
  const baseWhereClause = {
    product: {
      ...(categoryId && { group: { categoryId } }),
      ...(groupId && { groupId }),
    },
  };

  try {
    // Get today's data
    const todayData = await prisma.priceHistory.groupBy({
      by: ["productId", "subTypeName"],
      where: {
        ...baseWhereClause,
        priceDate: {
          gte: todayStart,
          lte: today,
        },
        marketPrice: {
          not: null,
        },
      },
      _avg: { marketPrice: true },
      _min: { marketPrice: true },
      _max: { marketPrice: true },
      _count: { marketPrice: true },
    });

    // Get yesterday's data for comparison
    const yesterdayData = await prisma.priceHistory.groupBy({
      by: ["productId", "subTypeName"],
      where: {
        ...baseWhereClause,
        priceDate: {
          gte: yesterdayStart,
          lte: yesterday,
        },
        marketPrice: {
          not: null,
        },
      },
      _avg: { marketPrice: true },
    });

    // Create a map for quick lookup of yesterday's data
    const yesterdayMap = new Map<string, number>();
    yesterdayData.forEach((prev) => {
      const key = `${prev.productId}-${prev.subTypeName || "null"}`;
      const avgPrice = decimalToNumber(prev._avg.marketPrice);
      if (avgPrice > 0) {
        yesterdayMap.set(key, avgPrice);
      }
    });

    // Combine and calculate trends
    const trends: WeeklyPriceTrend[] = todayData.map((current) => {
      const key = `${current.productId}-${current.subTypeName || "null"}`;
      const currentAvg = decimalToNumber(current._avg.marketPrice);
      const prevAvg = yesterdayMap.get(key) || 0;

      let dailyChange: number | null = null;
      if (prevAvg > 0) {
        dailyChange = (currentAvg - prevAvg) / prevAvg;
      }

      return {
        productId: current.productId,
        subTypeName: current.subTypeName,
        currentAvgPrice: currentAvg,
        prevAvgPrice: prevAvg,
        weeklyChange: dailyChange, // Reusing the field name for daily change
        weeklyDollarChange: currentAvg - prevAvg,
        minPrice: decimalToNumber(current._min.marketPrice),
        maxPrice: decimalToNumber(current._max.marketPrice),
        observationCount: current._count.marketPrice,
      };
    });

    // Sort by biggest percentage movers (absolute value)
    const sortedTrends = trends
      .filter((trend) => trend.currentAvgPrice > 0)
      .sort((a, b) => {
        const aChange = Math.abs(a.weeklyChange || 0);
        const bChange = Math.abs(b.weeklyChange || 0);
        return bChange - aChange;
      })
      .slice(0, limit);

    // Get product details for the top movers
    const productsWithTrends = await Promise.all(
      sortedTrends.map(async (trend) => {
        try {
          const product = await prisma.product.findFirst({
            where: {
              productId: trend.productId,
              subTypeName: trend.subTypeName,
            },
            include: {
              group: {
                include: {
                  category: {
                    select: {
                      id: true,
                      categoryId: true,
                      name: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          });

          return { ...trend, product };
        } catch (error) {
          console.error(`Error fetching product ${trend.productId}:`, error);
          return { ...trend, product: null };
        }
      }),
    );

    return productsWithTrends;
  } catch (error) {
    console.error("Error in getDailyPriceTrends:", error);
    throw new Error("Failed to fetch daily price trends");
  }
}
