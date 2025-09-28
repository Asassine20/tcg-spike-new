import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const subTypeName = searchParams.get("subTypeName");
    const timeRange = searchParams.get("timeRange") || "2w";

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate = new Date(now);

    switch (timeRange) {
      case "2w":
        startDate.setDate(now.getDate() - 14);
        break;
      case "1m":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3m":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6m":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 14);
    }

    const whereClause: any = {
      productId: parseInt(productId),
      priceDate: {
        gte: startDate,
      },
    };

    if (subTypeName) {
      whereClause.subTypeName = subTypeName;
    }

    const priceHistory = await prisma.priceHistory.findMany({
      where: whereClause,
      orderBy: {
        priceDate: "asc",
      },
      select: {
        priceDate: true,
        marketPrice: true,
      },
    });

    // Format the data for the chart
    const formattedData = priceHistory.map((item) => ({
      date: item.priceDate.toISOString().split("T")[0], // YYYY-MM-DD format
      price: item.marketPrice ? parseFloat(item.marketPrice.toString()) : 0,
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 },
    );
  }
}
