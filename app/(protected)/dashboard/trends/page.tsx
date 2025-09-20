import { redirect } from "next/dist/client/components/navigation";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/header";

import { loadFilterOptions } from "../../_lib/server/get-filter-options";
import ProductTrendsClientComponent from "./_components/product-trends-client";

export const dynamic = "force-dynamic";

// Import the client component

// Ensure you have a server client utility

// Metadata for the page
export const metadata = {
  title: "Market Trends",
};

// Define a type for the sets to be passed to the client component
export interface SetOption {
  group_id: number;
  name: string; // Changed from set_name to name to match tcgp_groups table and client component
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
  }>;
}) {
  const user = await getCurrentUser();

  if (!user?.id) redirect("/login");

  // const entitlementService = createEntitlementsService(supabase, auth.id);
  // const hasProAccount = await entitlementService.canUseFeature("pro");

  // Await searchParams before accessing its properties
  const params = await searchParams;

  // Get params from the URL, I need categoryId
  const categoryId = params.category ? parseInt(params.category) : 3;

  const filterOptions = await loadFilterOptions(categoryId);
  return (
    <>
      <DashboardHeader
        heading={"Market Trends"}
        text={"Explore TCG product price movements and trends."}
      />
      <ProductTrendsClientComponent filterOptions={filterOptions} />
    </>
  );
}
