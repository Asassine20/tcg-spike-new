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
  const rarities = await prisma.product.findMany({
    where: {
      group: {
        categoryId: categoryId,
      },
      rarity: {
        not: null,
        notIn: [""],
      },
    },
    select: {
      rarity: true,
    },
    distinct: ["rarity"],
    orderBy: {
      rarity: "asc",
    },
  });

  const rarityOptions = rarities
    .filter(
      (r): r is { rarity: string } => r.rarity !== null && r.rarity !== "",
    )
    .map((r) => ({
      value: r.rarity,
      label: r.rarity,
    }));

  const groups = await prisma.productGroup.findMany({
    where: {
      categoryId: categoryId,
    },
    orderBy: { publishedOn: "desc" },
    select: {
      groupId: true,
      name: true,
      publishedOn: true,
    },
  });

  const setErasMap = groups.map((group) => ({
    label: group.name,
    value: group.groupId,
    groups: [], // No sub-groups for Magic
  }));

  return {
    rarities: modifyRarities(rarityOptions),
    setEras: Array.from(setErasMap.values()),
  };
}

export const loadFilterOptions =
  process.env.NODE_ENV === "development"
    ? getFilterOptions
    : unstable_cache(getFilterOptions, ["getFilterOptions"], {
        revalidate: 60 * 60, // Revalidate every hour
      });
