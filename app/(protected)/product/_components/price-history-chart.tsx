"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface PriceHistoryChartProps {
  productId: number;
  subTypeName: string;
}

interface PriceDataPoint {
  date: string;
  price: number;
  formattedDate: string;
}

const chartConfig = {
  price: {
    label: "Market Price",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

function PriceHistoryChart({ productId, subTypeName }: PriceHistoryChartProps) {
  const [priceHistoryData, setPriceHistoryData] = useState<PriceDataPoint[]>(
    [],
  );
  const [phTimeRange, setPhTimeRange] = useState<
    "2w" | "1m" | "3m" | "6m" | "1y"
  >("2w");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPriceHistoryData = async () => {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("productId", productId.toString());
      params.set("subTypeName", subTypeName || "");
      params.set("timeRange", phTimeRange);

      try {
        const response = await fetch(`/api/price-history?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        setPriceHistoryData(
          data.map((item: { date: string; price: number }) => {
            const date = new Date(item.date);
            return {
              date: item.date,
              price: item.price,
              formattedDate: date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
            };
          }),
        );
      } catch (error) {
        console.error("Error fetching price history:", error);
        setPriceHistoryData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistoryData();
  }, [productId, subTypeName, phTimeRange]);

  // Calculate price trend
  const firstPrice = priceHistoryData[0]?.price || 0;
  const lastPrice = priceHistoryData[priceHistoryData.length - 1]?.price || 0;
  const priceChange = lastPrice - firstPrice;
  const percentChange = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Price History</CardTitle>
            <CardDescription>Market price over {phTimeRange}</CardDescription>
          </div>
          <div className="flex gap-2">
            {[
              { label: "2W", value: "2w" as const },
              { label: "1M", value: "1m" as const },
              { label: "3M", value: "3m" as const },
              { label: "6M", value: "6m" as const },
              { label: "1Y", value: "1y" as const },
            ].map(({ label, value }) => (
              <Button
                key={value}
                size="sm"
                variant={phTimeRange === value ? "default" : "outline"}
                onClick={() => setPhTimeRange(value)}
                disabled={loading}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        ) : priceHistoryData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <span className="text-lg text-muted-foreground">
              No price history data available.
            </span>
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={priceHistoryData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="formattedDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      `$${Number(value).toFixed(2)}`,
                      chartConfig.price?.label || "Price",
                    ]}
                  />
                }
              />
              <Line
                dataKey="price"
                type="monotone"
                stroke="var(--color-price)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
      {!loading && priceHistoryData.length > 0 && (
        <CardFooter className="flex-col gap-2 text-pretty text-center text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            {priceChange >= 0 ? (
              <>
                Price up by ${Math.abs(priceChange).toFixed(2)} (
                {Math.abs(percentChange).toFixed(1)}%)
                <TrendingUp className="size-4" />
              </>
            ) : (
              <>
                Price down by ${Math.abs(priceChange).toFixed(2)} (
                {Math.abs(percentChange).toFixed(1)}%)
                <TrendingDown className="size-4" />
              </>
            )}
          </div>
          <div className="leading-none text-muted-foreground">
            Showing market price for the selected time period
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export default PriceHistoryChart;
