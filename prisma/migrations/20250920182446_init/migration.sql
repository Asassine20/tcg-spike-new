-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_synced" TIMESTAMP(3),
    "display_name" TEXT NOT NULL,
    "seo_category_name" TEXT NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_eras" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "image_url" TEXT,

    CONSTRAINT "set_eras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_groups" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "logo_image" TEXT,
    "is_supplemental" BOOLEAN NOT NULL DEFAULT false,
    "published_on" TIMESTAMP(3) NOT NULL DEFAULT '1996-01-01T00:00:00Z',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT '1996-01-01T00:00:00Z',
    "last_synced" TIMESTAMP(3),
    "set_summary_synced_at" TIMESTAMP(3),
    "set_era_id" INTEGER,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "products_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tcgp_products" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "set_name" TEXT,
    "abbreviation" TEXT,
    "name" TEXT,
    "clean_name" TEXT,
    "image_url" TEXT,
    "url" TEXT,
    "market_price" DECIMAL(65,30),
    "prev_market_price" DECIMAL(65,30),
    "diff_market_price" DECIMAL(65,30),
    "dollar_diff_market_price" DECIMAL(65,30),
    "sub_type_name" TEXT,
    "type" TEXT,
    "rarity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_id" INTEGER,

    CONSTRAINT "tcgp_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_category_id_key" ON "product_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_groups_group_id_key" ON "products_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "tcgp_products_product_id_sub_type_name_key" ON "tcgp_products"("product_id", "sub_type_name");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_eras" ADD CONSTRAINT "set_eras_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_groups" ADD CONSTRAINT "products_groups_set_era_id_fkey" FOREIGN KEY ("set_era_id") REFERENCES "set_eras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_groups" ADD CONSTRAINT "products_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcgp_products" ADD CONSTRAINT "tcgp_products_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "products_groups"("group_id") ON DELETE SET NULL ON UPDATE CASCADE;
