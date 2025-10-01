import { useEffect, useState } from "react";

import { WeeklyPriceTrend } from "@/lib/price-analytics";

interface UsePriceTrendsOptions {
  categoryId?: number;
  groupId?: number;
  limit?: number;
  trend?: "weekly" | "daily";
  enabled?: boolean;
}

interface UsePriceTrendsResult {
  data: WeeklyPriceTrend[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePriceTrends(
  options: UsePriceTrendsOptions = {},
): UsePriceTrendsResult {
  const {
    categoryId,
    groupId,
    limit = 50,
    trend = "weekly",
    enabled = true,
  } = options;

  const [data, setData] = useState<WeeklyPriceTrend[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoryId) params.append("categoryId", categoryId.toString());
      if (groupId) params.append("groupId", groupId.toString());
      if (limit) params.append("limit", limit.toString());
      if (trend) params.append("trend", trend);

      const response = await fetch(`/api/trends?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result.trends || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch price trends";
      setError(errorMessage);
      console.error("Error fetching price trends:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [categoryId, groupId, limit, trend, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchTrends,
  };
}
