import { getCurrentUser } from "@/lib/session";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import DashboardPriceTrends from "@/app/(protected)/dashboard/_components/dashboard-price-trends";

export const metadata = constructMetadata({
  title: "Dashboard – SaaS Starter",
  description: "Create and manage content.",
});

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <>
      <div className="space-y-8">
        <DashboardPriceTrends />
      </div>
    </>
  );
}
