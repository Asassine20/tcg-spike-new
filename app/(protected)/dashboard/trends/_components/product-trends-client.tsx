"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { FilterOptions } from "../../../_lib/server/get-filter-options";
import DailyTrendsClientComponent from "./daily-trends-client";

// import { FilterOptions } from "../../_lib/server/get-filter-options";
// import DailyTrendsClientComponent from "./daily-trends-client";
// import WeeklyTrendsClientComponent from "./weekly-trends-client";

interface ProductTrendsClientProps {
  filterOptions: FilterOptions;
  hasProAccount?: boolean;
}

const ProductTrendsClientComponent: React.FC<ProductTrendsClientProps> = ({
  filterOptions,
  hasProAccount,
}) => {
  const getParams = useSearchParams();
  const router = useRouter();
  const [trendMode, setTrendMode] = useState<"daily" | "weekly">(
    () => (getParams.get("trend") as "daily" | "weekly") ?? "daily",
  );
  const weeklyButtonHoverText = "Upgrade to Pro to unlock weekly trends!";

  useEffect(() => {
    const params = new URLSearchParams(getParams.toString());
    params.set("trend", trendMode);
    // TODO: We need to reset page to 1 when trend mode changes. But this might require hoisting the variables.

    const newParams = params.toString();

    if (newParams !== getParams.toString()) {
      router.replace(`?${newParams}`, { scroll: false });
    }
  }, [trendMode, router]);

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">Trend:</span>
        <Button
          variant={trendMode === "daily" ? "default" : "outline"}
          size="sm"
          onClick={() => setTrendMode("daily")}
          aria-pressed={trendMode === "daily"}
        >
          Daily
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={trendMode === "weekly" ? "default" : "outline"}
                size="sm"
                aria-pressed={trendMode === "weekly"}
                // Do NOT use disabled attribute
                className={
                  !hasProAccount
                    ? "pointer-events-auto cursor-not-allowed opacity-50"
                    : ""
                }
                onClick={() => {
                  if (!hasProAccount) return; // Prevent click if not pro
                  setTrendMode("weekly");
                }}
                tabIndex={hasProAccount ? 0 : -1} // Remove from tab order if not pro
                data-test="weekly-trend-btn"
              >
                Weekly
                {!hasProAccount && (
                  <Lock className="ml-1 h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            {!hasProAccount && (
              <TooltipContent>
                <a
                  href="/home/billing"
                  className="text-white underline dark:text-black"
                >
                  {weeklyButtonHoverText}
                </a>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
      {trendMode === "daily" ? (
        <DailyTrendsClientComponent filterOptions={filterOptions} />
      ) : (
        "Weekly trends coming soon!"
      )}
    </>
  );
};

export default ProductTrendsClientComponent;
