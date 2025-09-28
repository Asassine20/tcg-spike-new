-- AlterTable
ALTER TABLE "tcgp_groups" ALTER COLUMN "published_on" SET DEFAULT '1996-01-01T00:00:00Z',
ALTER COLUMN "updated_at" SET DEFAULT '1996-01-01T00:00:00Z';

-- AlterTable
ALTER TABLE "tcgp_groups" ALTER COLUMN "published_on" SET DEFAULT '1996-01-01T00:00:00Z',
ALTER COLUMN "updated_at" SET DEFAULT '1996-01-01T00:00:00Z';

-- CreateTable
CREATE TABLE "price_history" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sub_type_name" TEXT NOT NULL,
    "price_date" DATE NOT NULL,
    "market_price" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_history_product_id_sub_type_name_price_date_key" ON "price_history"("product_id", "sub_type_name", "price_date");

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_sub_type_name_fkey" FOREIGN KEY ("product_id", "sub_type_name") REFERENCES "tcgp_products"("product_id", "sub_type_name") ON DELETE CASCADE ON UPDATE CASCADE;

-- Function to log previous product prices to price_history
CREATE OR REPLACE FUNCTION public.log_previous_product_price_to_history()
RETURNS TRIGGER AS $$
BEGIN
    -- OLD.updated_at contains the timestamp when the previous prices were last set.
    -- We use its date part as the price_date for the historical record.
    -- This assumes OLD.updated_at is not null, which should be true if the record
    -- was previously inserted/updated, as tcgp_products.updated_at defaults to now().
    IF OLD.updated_at IS NOT NULL THEN
        INSERT INTO public.price_history (
            product_id, -- This is tcgp_products.product_id (TCGPlayer's ID)
            price_date,
            market_price,
            sub_type_name
            -- created_at and updated_at in price_history will use their defaults
        )
        VALUES (
            OLD.product_id,       -- The TCGPlayer product ID from the OLD record
            OLD.updated_at::date, -- The date for which these OLD prices were valid
            OLD.market_price,
            OLD.sub_type_name
        )
        ON CONFLICT (product_id, sub_type_name, price_date) DO NOTHING;
        -- DO NOTHING: If a record for this product_id and price_date already exists,
        -- (e.g. from a previous run or manual entry), don't attempt to insert again.
        -- This effectively captures the state at the end of OLD.updated_at::date.
    END IF;

    RETURN NEW; -- The result of an AFTER trigger is ignored, but returning NEW is conventional.
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute the history logging function after an update on tcgp_products
CREATE TRIGGER trigger_log_price_history_after_product_update
AFTER UPDATE ON public.tcgp_products
FOR EACH ROW
-- This WHEN condition ensures the trigger only fires if price-related fields actually change.
-- It mirrors the WHEN condition of your calculate_product_price_diffs trigger.
WHEN ((
    (old.market_price IS NOT NULL) 
    AND (new.market_price IS NOT NULL) 
    ))
EXECUTE FUNCTION public.log_previous_product_price_to_history();

-- Create updated_at function and create triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
   -- Attempt to set updated_at, but handle cases where the column might not exist
   begin
      new.updated_at = now();
   exception
      when undefined_column then
         -- The column "updated_at" does not exist on this table.
         RAISE NOTICE 'Column "updated_at" not found on table %.%, ignoring update to this column.', TG_TABLE_SCHEMA, TG_TABLE_NAME;
         null;
   end;
   return new;
end;
$function$
;

-- Trigger to update updated_at column on tcgp_products
create trigger handle_products_updated_at before update on public.tcgp_products
  for each row execute procedure public.update_updated_at_column();

-- Trigger to update updated_at column on tcgp_groups
create trigger handle_groups_updated_at before update on public.tcgp_groups
  for each row execute procedure public.update_updated_at_column();