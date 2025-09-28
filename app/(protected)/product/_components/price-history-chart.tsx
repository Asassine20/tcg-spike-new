'use client';

import { useEffect, useState } from 'react';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { TooltipProvider } from '@kit/ui/tooltip';

import { Database } from '~/lib/database.types';

import { PriceHistoryData } from '../_lib/server/get-price-history-data';

interface PriceHistoryChartProps {
  productId: number;
  subTypeName: string;
}

function PriceHistoryChart({ productId, subTypeName }: PriceHistoryChartProps) {
  const [priceHistoryData, setPriceHistoryData] = useState<PriceHistoryData[]>(
    [],
  );
  const [phTimeRange, setPhTimeRange] = useState<'2w' | '1m' | '3m' | '1y'>(
    '2w',
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPriceHistoryData = async () => {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('productId', productId.toString());
      params.set('subTypeName', subTypeName || '');
      params.set('timeRange', phTimeRange);

      try {
        const response = await fetch(`/api/price-history?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        setPriceHistoryData(
          data.map((item: { date: string; price: number }) => {
            const [year, month, day] = item.date.split('-');
            return {
              date: `${month}/${day}/${year}`,
              'Market Price': item.price,
            };
          }),
        );
      } catch (error) {
        console.error('Error fetching price history:', error);
        setPriceHistoryData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistoryData();
  }, [productId, phTimeRange]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Price History</CardTitle>
          <div className="flex gap-2">
            {[
              { label: '2w', value: '2w' },
              { label: '3m', value: '3m' },
              { label: '6m', value: '6m' },
              { label: '1yr', value: '1y' },
            ].map(({ label, value }) => (
              <Button
                key={value}
                size="sm"
                variant={phTimeRange === value ? 'default' : 'outline'}
                onClick={() => setPhTimeRange(value as any)}
                disabled={loading}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative h-96">
        <ResponsiveContainer width="100%" height="100%">
          {loading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
              <LoadingOverlay fullPage={false}>Loading...</LoadingOverlay>
            </div>
          ) : (
            <LineChart
              data={priceHistoryData}
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => {
                  const [month, day] = date.split('/');
                  return `${month}/${day}`;
                }}
              />
              <YAxis
                domain={['auto', 'auto']} // Automatically adjust the Y-axis range
                tickFormatter={(value) =>
                  `$${value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                }
              />
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toFixed(2)}`,
                  'Market Price',
                ]}
              />
              <Line
                type="monotone"
                dataKey="Market Price"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
        {!loading && priceHistoryData.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <span className="text-muted-foreground text-lg">
              No price history data available.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PriceHistoryChart;
