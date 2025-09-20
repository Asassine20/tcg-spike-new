export interface CategoryOption {
  value: number;
  label: string;
  imageSrc?: string;
  categoryId: number;
  disabled?: boolean;
}

export const categoryOptions: CategoryOption[] = [
  {
    value: 3,
    label: "Pokémon",
    imageSrc: "/images/logos/categories/pkmn-logo.png",
    categoryId: 3,
  },
  {
    value: 1,
    label: "Magic the Gathering",
    imageSrc: "/images/logos/categories/mtg-logo.png",
    categoryId: 1,
  },
  {
    value: 68,
    label: "One Piece",
    imageSrc: "/images/logos/categories/one-piece-logo.svg",
    categoryId: 68,
  },
  {
    value: 0,
    label: "More Coming Soon!",
    categoryId: 0,
    disabled: true,
  },
];

export interface TcgTypeOption {
  value: string;
  label: string;
}

export const tcgTypeOptions: Record<number, TcgTypeOption[]> = {
  1: [
    // Magic: The Gathering (categoryId: 1)
    { value: "card", label: "Singles" },
    { value: "sealed", label: "Sealed Products" },
  ],
  3: [
    // Pokémon TCG (categoryId: 3)
    { value: "card", label: "Singles" },
    { value: "sealed", label: "Sealed Products" },
  ],
};
