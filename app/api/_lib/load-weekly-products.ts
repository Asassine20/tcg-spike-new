import { unstable_cache } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { Database } from '~/lib/database.types';

type Product = Database['public']['Views']['view_weekly_price_trends']['Row'];

export interface LoadProductsResult {
  canAccessCompetitive: boolean;
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface LoadWeeklyProductProps {
  selectedCategoryId: number;
  selectedGroupIds?: number[];
  pageSize: number;
  page: number;
  priceRange: string | null;
  rarities: string[];
  searchTerm: string | null;
  sortColumn: string;
  sortDirection: string;
  productType: string[];
}

async function fetchWeeklyProducts({
  selectedCategoryId = 3,
  selectedGroupIds = [],
  pageSize = 20,
  page = 1,
  priceRange,
  rarities = [],
  searchTerm,
  sortColumn = 'market_price',
  sortDirection = 'desc',
  productType = ['card'],
}: LoadWeeklyProductProps): Promise<LoadProductsResult> {
  const supabase = getSupabaseServerAdminClient();
  try {
    // Validate sort column to prevent SQL injection
    const validSortColumns = [
      'name',
      'clean_name',
      'set_name',
      'current_avg_market_price',
      'prev_avg_market_price',
      'weekly_diff_market_price',
      'weekly_dollar_diff_market_price',
      'updated_at',
    ];

    // Validate product type
    const validProductTypes = ['card', 'trainer', 'sealed', 'code', 'energy'];
    if (productType.some((pt) => !validProductTypes.includes(pt))) {
      throw new Error(
        `Invalid product type provided in ${productType.join(', ')}`,
      );
    }

    const actualSortColumn = validSortColumns.includes(sortColumn)
      ? sortColumn
      : 'current_avg_market_price';

    // Calculate pagination limits
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    // Build base query with all columns including price history data
    let query = supabase
      .from('view_weekly_price_trends')
      .select('*', { count: 'exact' })
      .eq('category_id', selectedCategoryId);

    // Apply filters
    if (productType.length > 0) {
      query = query.in('type', productType);
    }

    if (searchTerm) {
      query = query.ilike('clean_name', `%${searchTerm}%`);
    }

    if (selectedGroupIds.length > 0) {
      query = query.in('group_id', selectedGroupIds);
    }

    // Apply price range filter if provided
    if (priceRange) {
      if (priceRange === '0-5') {
        query = query
          .gte('current_avg_market_price', 0)
          .lt('current_avg_market_price', 5);
      } else if (priceRange === '5-20') {
        query = query
          .gte('current_avg_market_price', 5)
          .lt('current_avg_market_price', 20);
      } else if (priceRange === '20+') {
        query = query.gte('current_avg_market_price', 20);
      }
    }

    // Apply rarities filter if provided
    if (rarities.length > 0) {
      query = query.in('rarity', rarities);
    }

    // Add filtering for null values based on sort column
    if (
      [
        'current_avg_market_price',
        'prev_avg_market_price',
        'weekly_diff_market_price',
        'weekly_dollar_diff_market_price',
      ].includes(actualSortColumn) &&
      sortDirection === 'desc'
    ) {
      // When sorting by price in descending order, exclude null values
      query = query.not(actualSortColumn, 'is', null);
    }

    console.warn(
      'actualSortColumn:',
      actualSortColumn,
      'sortDirection:',
      sortDirection,
    );

    // Apply sorting and pagination
    query = query
      .order(actualSortColumn, {
        ascending: sortDirection === 'asc',
      })
      .range(fromIndex, toIndex);

    console.warn('query:', query);

    // Execute query
    const { data: cards, count: totalCount, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching cards:', fetchError);
      throw new Error('Failed to fetch cards');
    }

    // Calculate total pages
    const totalPages = Math.ceil((totalCount ?? 0) / pageSize);

    return {
      products: cards ?? [],
      totalCount: totalCount ?? 0,
      page,
      pageSize,
      totalPages,
      canAccessCompetitive: true,
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    throw new Error('Internal server error');
  }
}

// Conditional export: disable unstable_cache in development
declare const process: { env: { NODE_ENV: string } };

export const loadWeeklyProducts =
  process.env.NODE_ENV === 'development'
    ? fetchWeeklyProducts
    : unstable_cache(fetchWeeklyProducts, ['weekly-products'], {
        // Revalidate the cache every hour (3600 seconds)
        revalidate: 3600,
        // Add a tag for on-demand revalidation if needed in the future
        tags: ['weekly-products'],
      });
