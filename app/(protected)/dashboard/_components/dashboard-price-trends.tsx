"use client";

import { useState } from "react";
import { Calendar, Clock, TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriceTrends } from "@/components/dashboard/price-trends";

// TCG Categories - you can move this to a shared constants file
const TCG_CATEGORIES = [
  { id: 1, name: "Magic: The Gathering", value: "1" },
  { id: 2, name: "Yu-Gi-Oh!", value: "2" },
  { id: 3, name: "Pokemon", value: "3" },
  { id: 4, name: "Lorcana", value: "4" },
  { id: 5, name: "One Piece", value: "5" },
] as const;

interface DashboardPriceTrendsProps {
  className?: string;
}

export default function DashboardPriceTrends({
  className,
}: DashboardPriceTrendsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("3"); // Default to Pokemon

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header with Category Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <TrendingUp className="h-6 w-6 text-primary" />
              Price Trends
            </h2>
            <p className="text-muted-foreground">
              Top price movers across daily and weekly timeframes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Category:</span>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TCG_CATEGORIES.map((category) => (
                  <SelectItem key={category.id} value={category.value}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Trends Grid - Responsive Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily Trends */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                Daily Movers
              </CardTitle>
              <CardDescription>
                Biggest price changes in the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <PriceTrends
                categoryId={
                  selectedCategory ? parseInt(selectedCategory) : undefined
                }
                limit={10}
                trend="daily"
                showImages={true}
              />
            </CardContent>
          </Card>

          {/* Weekly Trends */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-green-600" />
                Weekly Movers
              </CardTitle>
              <CardDescription>
                Biggest price changes over the past week
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <PriceTrends
                categoryId={
                  selectedCategory ? parseInt(selectedCategory) : undefined
                }
                limit={10}
                trend="weekly"
                showImages={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Daily Average Change
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+2.4%</div>
              <p className="text-xs text-muted-foreground">
                Across top 10 movers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Weekly Average Change
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">+5.8%</div>
              <p className="text-xs text-muted-foreground">
                Across top 10 movers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Products
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-xs text-muted-foreground">
                With price data today
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
