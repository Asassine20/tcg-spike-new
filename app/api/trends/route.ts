import { NextRequest } from "next/server";

import {
  getDailyPriceTrends,
  getWeeklyPriceTrends,
} from "@/lib/price-analytics";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const groupId = searchParams.get("groupId");
    const limit = searchParams.get("limit");
    const trend = searchParams.get("trend") || "weekly"; // 'weekly' or 'daily'

    // Validate and parse parameters
    const options = {
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      groupId: groupId ? parseInt(groupId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    };

    // Validate numeric parameters
    if (categoryId && isNaN(options.categoryId!)) {
      return Response.json(
        { error: "Invalid categoryId parameter" },
        { status: 400 },
      );
    }

    if (groupId && isNaN(options.groupId!)) {
      return Response.json(
        { error: "Invalid groupId parameter" },
        { status: 400 },
      );
    }

    if (
      limit &&
      (isNaN(options.limit) || options.limit < 1 || options.limit > 200)
    ) {
      return Response.json(
        { error: "Invalid limit parameter. Must be between 1 and 200" },
        { status: 400 },
      );
    }

    // Get the appropriate trends based on the trend parameter
    let trends;
    if (trend === "daily") {
      trends = await getDailyPriceTrends(options);
    } else {
      trends = await getWeeklyPriceTrends(options);
    }

    // Format response with metadata
    const response = {
      trends,
      metadata: {
        count: trends.length,
        trend: trend,
        filters: {
          categoryId: options.categoryId,
          groupId: options.groupId,
          limit: options.limit,
        },
        generatedAt: new Date().toISOString(),
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error("Error in price trends API:", error);

    return Response.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
