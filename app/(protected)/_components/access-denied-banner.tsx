"use client";

import React from "react";
import Link from "next/link";
import { InfoIcon, LockIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AccessDeniedBannerProps {
  className?: string;
  title?: string;
  message?: string;
}

const AccessDeniedBanner: React.FC<AccessDeniedBannerProps> = ({
  className,
  title = "Unlock Full Data Insights",
  message = "You're currently viewing a limited dataset. Upgrade your plan for complete access.",
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-700 shadow-sm dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300 sm:flex-row sm:gap-6",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <InfoIcon className="h-8 w-8 flex-shrink-0 text-rose-500 dark:text-rose-400" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm opacity-90">{message}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="flex-shrink-0 border-rose-500 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-600 dark:text-rose-400 dark:hover:bg-rose-800/50 dark:hover:text-rose-300"
      >
        <Link href="/home/billing">
          <LockIcon className="mr-2 h-4 w-4" />
          Upgrade Plan
        </Link>
      </Button>
    </div>
  );
};

export default AccessDeniedBanner;
