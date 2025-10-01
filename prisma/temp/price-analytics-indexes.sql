-- Indexes for price analytics performance
-- These indexes optimize the groupBy queries in price-analytics.ts

-- Index for date range queries with product identification
CREATE INDEX IF NOT EXISTS idx_price_history_date_lookup 
ON price_history(price_date, product_id, sub_type_name);

-- Index for product-specific historical data queries  
CREATE INDEX IF NOT EXISTS idx_price_history_product_date 
ON price_history(product_id, sub_type_name, price_date);

-- Index for market price queries (excludes null prices)
CREATE INDEX IF NOT EXISTS idx_price_history_market_price 
ON price_history(market_price) WHERE market_price IS NOT NULL;

-- Composite index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_price_history_analytics 
ON price_history(price_date, market_price, product_id, sub_type_name) 
WHERE market_price IS NOT NULL;