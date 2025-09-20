import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

export interface GetFilterOptionsParams {
  categoryId?: number;
}

type SetEraOption = {
  label: string; // Era name
  value: string | number; // Era id
  groups: {
    label: string; // Group name
    value: string | number; // Group id
  }[];
};
export interface RarityOption {
  value: string;
  label: string;
}
export interface FilterOptions {
  rarities: RarityOption[];
  setEras: SetEraOption[];
}

const topTierRarities: RarityOption[] = [
  { value: "Common", label: "Common" },
  { value: "Uncommon", label: "Uncommon" },
  { value: "Rare", label: "Rare" },
  { value: "Illustration Rare", label: "Illustration Rare" },
  {
    value: "Special Illustration Rare",
    label: "Special Illustration Rare",
  },
  { value: "Ultra Rare", label: "Ultra Rare" },
];

function modifyRarities(rarities: RarityOption[]): RarityOption[] {
  // Create a Set of top-tier rarity values for efficient lookup
  const topTierValues = new Set(topTierRarities.map((r) => r.value));

  // Filter the incoming rarities to find which ones are not top-tier
  const otherRarities = rarities
    .filter((rarity) => !topTierValues.has(rarity.value))
    .filter((rarity) => rarity.value !== "")
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort the others alphabetically

  // Create a Set of all available rarities from the database for filtering
  const availableRarityValues = new Set(rarities.map((r) => r.value));

  // Filter the predefined top-tier list to only include what's available
  const availableTopTierRarities = topTierRarities.filter((rarity) =>
    availableRarityValues.has(rarity.value),
  );

  // Combine the two lists: available top-tier rarities first, then the sorted others
  return [...availableTopTierRarities, ...otherRarities];
}

async function getFilterOptions(categoryId = 3): Promise<FilterOptions> {
  return {
    rarities: topTierRarities,
    setEras: [],
  };
  //   return {
  //     rarities: modifyRarities(
  //       await prisma.$queryRaw<RarityOption[]>`
  //         SELECT DISTINCT rarity
  //         FROM tcgp_cards
  //         WHERE category_id = ${categoryId}
  //         AND rarity IS NOT NULL
  //       `,
  //     ),
  //     setEras: await prisma.$queryRaw<SetEraOption[]>`
  //       SELECT
  //         se.id AS label,
  //         se.id AS value,
  //         json_agg(
  //           jsonb_build_object(
  //             'label', g.name,
  //             'value', g.id
  //           ) ORDER BY g.name
  //         ) AS groups
  //       FROM tcgp_sets AS se
  //       JOIN tcgp_groups AS g ON se.group_id = g.id
  //       WHERE se.category_id = ${categoryId}
  //       GROUP BY se.id, g.name, g.id
  //       ORDER BY se.id DESC, g.name;
  //     `,
  //   };
}

export const loadFilterOptions =
  process.env.NODE_ENV === "development"
    ? getFilterOptions
    : unstable_cache(getFilterOptions, ["getFilterOptions"], {
        revalidate: 60 * 60, // Revalidate every hour
      });
