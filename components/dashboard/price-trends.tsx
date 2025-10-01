"use client";

import Image from "next/image";
import { DollarSign, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { usePriceTrends } from "@/hooks/use-price-trends";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceTrendsProps {
  categoryId?: number;
  groupId?: number;
  limit?: number;
  trend?: "weekly" | "daily";
  title?: string;
  showImages?: boolean;
}

export function PriceTrends({
  categoryId,
  groupId,
  limit = 20,
  trend = "weekly",
  title,
  showImages = true,
}: PriceTrendsProps) {
  const {
    data: trends,
    loading,
    error,
  } = usePriceTrends({
    categoryId,
    groupId,
    limit,
    trend,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatPercentage = (change: number | null) => {
    if (change === null) return "N/A";
    const percentage = (change * 100).toFixed(2);
    return `${change >= 0 ? "+" : ""}${percentage}%`;
  };

  const getTrendIcon = (change: number | null) => {
    if (change === null || Math.abs(change) < 0.001) {
      return <Minus className="size-4 text-gray-500" />;
    }
    return change > 0 ? (
      <TrendingUp className="size-4 text-green-600" />
    ) : (
      <TrendingDown className="size-4 text-red-600" />
    );
  };

  const getTrendColor = (change: number | null) => {
    if (change === null || Math.abs(change) < 0.001) return "secondary";
    return change > 0 ? "default" : "destructive";
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            Error loading price trends: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-5" />
          {title || `${trend === "weekly" ? "Weekly" : "Daily"} Price Movers`}
        </CardTitle>
        <CardDescription>
          Top {limit} products with the biggest price changes{" "}
          {trend === "weekly" ? "this week" : "today"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                {showImages && <Skeleton className="size-16 rounded" />}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : trends && trends.length > 0 ? (
          <div className="space-y-4">
            {trends.map((trend, index) => (
              <div
                key={`${trend.productId}-${trend.subTypeName}-${index}`}
                className="flex items-center space-x-4 rounded-lg border p-3"
              >
                {showImages && trend.product?.imageUrl && (
                  <div className="relative size-16 shrink-0">
                    <Image
                      src={trend.product.imageUrl}
                      alt={trend.product.name || "Product image"}
                      fill
                      className="rounded object-cover"
                      sizes="64px"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-medium">
                    {trend.product?.name || `Product ${trend.productId}`}
                  </h4>
                  <p className="truncate text-sm text-muted-foreground">
                    {trend.product?.group?.name} •{" "}
                    {trend.subTypeName || "Standard"}
                  </p>
                  {trend.product?.rarity && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {trend.product.rarity}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-right">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(trend.weeklyChange)}
                    <span className="font-semibold">
                      {formatPrice(trend.currentAvgPrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Badge
                      variant={getTrendColor(trend.weeklyChange)}
                      className="text-xs"
                    >
                      {formatPercentage(trend.weeklyChange)}
                    </Badge>
                    <span
                      className={`text-xs ${
                        trend.weeklyDollarChange >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {trend.weeklyDollarChange >= 0 ? "+" : ""}
                      {formatPrice(trend.weeklyDollarChange)}
                    </span>
                  </div>

                  {trend.prevAvgPrice > 0 && (
                    <div className="text-xs text-muted-foreground">
                      was {formatPrice(trend.prevAvgPrice)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No price trends data available for the selected criteria.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
