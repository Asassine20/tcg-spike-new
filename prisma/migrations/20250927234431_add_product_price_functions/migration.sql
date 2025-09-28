-- AlterTable
ALTER TABLE "tcgp_groups" ALTER COLUMN "published_on" SET DEFAULT '1996-01-01T00:00:00Z',
ALTER COLUMN "updated_at" SET DEFAULT '1996-01-01T00:00:00Z';

-- Function to calculate price differences and store previous prices
CREATE OR REPLACE FUNCTION public.calculate_product_price_diffs()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if this is an UPDATE operation (not INSERT)
    IF TG_OP = 'UPDATE' THEN
        -- Update previous prices from the OLD row record
        NEW.prev_market_price = OLD.market_price;

        -- Calculate dollar differences (handle NULLs properly)
        NEW.dollar_diff_market_price = COALESCE(NEW.market_price, 0) - COALESCE(OLD.market_price, 0);

        -- Calculate percentage differences (only if OLD price exists and > 0)

        IF OLD.market_price IS NOT NULL AND OLD.market_price > 0 AND NEW.market_price IS NOT NULL THEN
            NEW.diff_market_price = (NEW.market_price - OLD.market_price) / OLD.market_price;
        ELSE
            NEW.diff_market_price = NULL;
        END IF;
    ELSE
        -- For INSERT operations, ensure diff fields are NULL
        NEW.prev_market_price = NULL;
        NEW.diff_market_price = NULL;
        NEW.dollar_diff_market_price = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and recreate with correct timing
DROP TRIGGER IF EXISTS handle_product_price_diffs_and_prev ON public.tcgp_products;

-- Trigger to execute AFTER updated_at trigger but still BEFORE the actual update
CREATE TRIGGER handle_product_price_diffs_and_prev
BEFORE UPDATE ON public.tcgp_products
FOR EACH ROW
EXECUTE FUNCTION public.calculate_product_price_diffs();


-- Add a function for upserting tcgp_product records and record previous prices
CREATE OR REPLACE FUNCTION upsert_tcgp_products(
  p_product_id int4,
  p_set_name text,
  p_abbreviation text,
  p_name text,
  p_clean_name text,
  p_image_url text,
  p_url text,
  p_market_price numeric,
  p_sub_type_name text,
  p_type text,
  p_rarity text,
  p_group_id int4
) RETURNS void AS $$
BEGIN

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'p_product_id cannot be null';
  END IF;
  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'p_group_id cannot be null';
  END IF;

  -- Use INSERT ... ON CONFLICT for proper upsert behavior
  INSERT INTO public.tcgp_products (
    product_id, set_name, abbreviation, name, clean_name, image_url, url,
    market_price,
    sub_type_name, type, rarity, group_id
  ) VALUES (
    p_product_id, p_set_name, p_abbreviation, p_name, p_clean_name, p_image_url, p_url,
    p_market_price,
    p_sub_type_name, p_type, p_rarity, p_group_id
  )
  ON CONFLICT (product_id, sub_type_name)
  DO UPDATE SET
    set_name = EXCLUDED.set_name,
    abbreviation = EXCLUDED.abbreviation,
    name = EXCLUDED.name,
    clean_name = EXCLUDED.clean_name,
    image_url = EXCLUDED.image_url,
    url = EXCLUDED.url,
    market_price = EXCLUDED.market_price,
    type = EXCLUDED.type,
    rarity = EXCLUDED.rarity,
    group_id = EXCLUDED.group_id;
    -- Triggers will handle prev/diff calculations and updated_at

END;
$$ LANGUAGE 'plpgsql';


-- Add a custom type to support batch upserts.
-- This defines the shape of the product objects you'll send in an array.
CREATE TYPE public.tcgp_product_upsert_type AS (
    product_id integer,
    set_name text,
    abbreviation text,
    name text,
    clean_name text,
    image_url text,
    url text,
    market_price numeric,
    sub_type_name text,
    "type" text,
    rarity text,
    group_id integer
);

-- Add a batch upsert function to process multiple products in one RPC call.
-- This function is much more efficient than calling the single-upsert function in a loop.
CREATE OR REPLACE FUNCTION public.upsert_tcgp_products_batch(p_products public.tcgp_product_upsert_type[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.tcgp_products (
    product_id, set_name, abbreviation, name, clean_name, image_url, url,
    market_price,
    sub_type_name, type, rarity, group_id
  )
  SELECT
    p.product_id, p.set_name, p.abbreviation, p.name, p.clean_name, p.image_url, p.url,
    p.market_price,
    p.sub_type_name, p.type, p.rarity, p.group_id
  FROM unnest(p_products) AS p
  ON CONFLICT (product_id, sub_type_name)
  DO UPDATE SET
    set_name = EXCLUDED.set_name,
    abbreviation = EXCLUDED.abbreviation,
    name = EXCLUDED.name,
    clean_name = EXCLUDED.clean_name,
    image_url = EXCLUDED.image_url,
    url = EXCLUDED.url,
    market_price = EXCLUDED.market_price,
    type = EXCLUDED.type,
    rarity = EXCLUDED.rarity,
    group_id = EXCLUDED.group_id;
END;
$function$;