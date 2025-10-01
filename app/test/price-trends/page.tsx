import { PriceTrends } from "@/components/dashboard/price-trends";

export default function PriceTrendsTestPage() {
  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Price Trends Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time price movement analysis for TCG products
        </p>
      </div>

      <div className="grid gap-8">
        {/* Weekly Trends */}
        <PriceTrends limit={20} trend="weekly" title="Weekly Price Movers" />

        {/* Daily Trends */}
        <PriceTrends limit={15} trend="daily" title="Daily Price Movers" />

        {/* Category-specific trends (Pokemon = categoryId 3) */}
        <PriceTrends
          categoryId={3}
          limit={10}
          trend="weekly"
          title="Pokemon Weekly Movers"
        />
      </div>
    </div>
  );
}
