"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Search,
  ShapesIcon,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AccessDeniedBanner from "@/app/(protected)/_components/access-denied-banner";
import { FilterDropdown } from "@/app/(protected)/_components/filter-dropdown";

import {
  CategoryOption,
  categoryOptions,
  TcgTypeOption,
  tcgTypeOptions,
} from "../../../_lib/constants/filter-option-constants";
import {
  FilterOptions,
  RarityOption,
} from "../../../_lib/server/get-filter-options";

const ANY_PRICE_RANGE = "any";
const ANY_PRICE_RANGE_LABEL = "Any";

// Props type for the client component - will receive initial data from the server component
interface DailyTrendsClientProps {
  filterOptions: FilterOptions;
}

interface Product {
  id: number;
  productId: number;
  name: string | null;
  subTypeName: string | null;
  setName: string | null;
  imageUrl: string | null;
  marketPrice: number | null;
  diffMarketPrice: number | null;
  dollarDiffMarketPrice: number | null;
  rarity: string | null;
  url: string | null;
}

const DailyTrendsClientComponent: React.FC<DailyTrendsClientProps> = ({
  filterOptions,
}) => {
  const getParams = useSearchParams();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState<CategoryOption>(
    () => {
      const categoryIdFromUrl = getParams.get("category");
      if (categoryIdFromUrl) {
        const foundCategory = categoryOptions.find(
          (opt) => String(opt.categoryId) === categoryIdFromUrl,
        );
        if (foundCategory) return foundCategory;
      }
      // Default to Pokémon (ID 3) or the first option if Pokémon TCG is not found or no param
      return (
        categoryOptions.find((opt) => opt.categoryId === 3) ||
        categoryOptions[0]!
      );
    },
  );

  const [typeOptions, setTypeOptions] = useState<TcgTypeOption[]>(() => {
    return (
      tcgTypeOptions[selectedCategory.categoryId] ?? tcgTypeOptions[3] ?? []
    );
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [accessDeniedError, setAccessDeniedError] = useState<boolean>(false);

  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    () => getParams.get("groups")?.split(",") ?? [],
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(() =>
    Number(getParams.get("page") ?? "1"),
  );
  const [itemsPerPage, setItemsPerPage] = useState<number>(() =>
    Number(getParams.get("limit") ?? "25"),
  );
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState<string>(
    () => getParams.get("q") ?? "",
  );
  const [priceRange, setPriceRange] = useState<string>(
    () => getParams.get("price") ?? ANY_PRICE_RANGE,
  );
  const [productType, setProductType] = useState<string[]>(() => {
    const typeParam = getParams.get("type");
    return typeParam ? typeParam.split(",") : ["card"];
  });
  const [rarities, setRarities] = useState<string[]>(
    () => getParams.get("rarity")?.split(",") ?? [],
  );
  const [sortColumn, setSortColumn] = useState<string>(
    () => getParams.get("sort_by") ?? "diff_market_price",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    () => (getParams.get("sort_dir") as "asc" | "desc") ?? "desc",
  );
  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");
  const [previewX, setPreviewX] = useState<number>(0);
  const [previewY, setPreviewY] = useState<number>(0);

  const handleCategoryChange = (category: CategoryOption) => {
    setSelectedCategory(category);
    setTypeOptions(
      tcgTypeOptions[category.categoryId] ?? tcgTypeOptions[3] ?? [],
    );
    const newTypeOptions =
      tcgTypeOptions[category.categoryId] ?? tcgTypeOptions[3] ?? [];
    setProductType(
      newTypeOptions.length > 0 && newTypeOptions[0]
        ? [newTypeOptions[0].value]
        : [],
    ); // Reset product types when changing category
    setCurrentPage(1); // Reset page
    setSelectedGroups([]);
    setRarities([]);
  };

  const handleMultiSelectGroupChange = (selectedGroups: string[]) => {
    setSelectedGroups(selectedGroups);
    setCurrentPage(1); // Reset page
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc"); // Default to ascending for a new column
    }
    setCurrentPage(1); // Reset page when sorting changes
  };

  const PREVIEW_OFFSET = 10;
  const PREVIEW_MAX_WIDTH = 250;
  const PREVIEW_MAX_HEIGHT = 300;

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    // use React’s SyntheticMouseEvent instead of the DOM MouseEvent
    let x = e.clientX + PREVIEW_OFFSET;
    let y = e.clientY + PREVIEW_OFFSET;
    const maxX = window.innerWidth - PREVIEW_MAX_WIDTH - PREVIEW_OFFSET;
    const maxY = window.innerHeight - PREVIEW_MAX_HEIGHT - PREVIEW_OFFSET;
    if (x > maxX) x = maxX;
    if (y > maxY) y = maxY;
    setPreviewX(x);
    setPreviewY(y);
  };

  function getRarityInitials(rarity: string): string {
    return rarity
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }

  function getRarityStyle(rarity: string): string {
    const rarityLower = rarity.toLowerCase();

    // Special holos and ultra rares
    if (rarityLower.includes("secret") || rarityLower.includes("ultra")) {
      return "bg-gradient-to-br from-[#ffd700] to-[#b8860b] text-black font-bold";
    }
    // Holo rares
    else if (rarityLower.includes("holo")) {
      return "bg-gradient-to-br from-[#e6c200] to-[#ffd700] text-black font-bold";
    }
    // Rares
    else if (rarityLower.includes("rare")) {
      return "bg-[#ffd700] text-black font-bold";
    }
    // Default for unknown rarities
    else {
      return "bg-gray-600 text-white";
    }
  }

  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedCategory)
      params.set("category", String(selectedCategory.categoryId));
    if (selectedGroups.length > 0)
      params.set("groups", selectedGroups.join(","));
    if (searchTerm) params.set("q", searchTerm);
    if (productType.length > 0) params.set("type", productType.join(","));
    if (priceRange) params.set("price", priceRange);
    if (rarities && rarities.length > 0)
      params.set("rarity", rarities.join(","));
    params.set("limit", String(itemsPerPage));
    params.set("page", String(currentPage));
    if (sortColumn) params.set("sort_by", sortColumn);
    if (sortDirection) params.set("sort_dir", sortDirection); // Optionally add to URL for clarity

    const newSearchQuery = params.toString();
    const currentSearchQuery = getParams.toString();

    if (newSearchQuery !== currentSearchQuery) {
      router.replace(`?${newSearchQuery}`, { scroll: false });
    }
  }, [
    selectedCategory,
    selectedGroups,
    searchTerm,
    productType,
    priceRange,
    rarities,
    itemsPerPage,
    currentPage,
    router,
    getParams,
    sortColumn,
    sortDirection,
  ]);

  useEffect(() => {
    const fetchProductsData = async () => {
      setLoading(true);
      setAccessDeniedError(false);
      if (!selectedCategory) return;

      const params = new URLSearchParams();
      params.set("category", String(selectedCategory.categoryId));
      if (selectedGroups.length > 0) {
        params.set("groups", selectedGroups.join(","));
      }
      params.set("limit", String(itemsPerPage));
      params.set("page", String(currentPage));
      if (priceRange && priceRange !== "any") {
        params.set("price", priceRange);
      }
      if (rarities && rarities.length > 0) {
        params.set("rarity", rarities.join(","));
      }
      if (searchTerm) {
        params.set("q", searchTerm);
      }
      params.set("sort_by", sortColumn);
      params.set("sort_dir", sortDirection);
      if (productType.length > 0) {
        params.set("type", productType.join(","));
      }

      try {
        const response = await fetch(
          `/api/daily-products?${params.toString()}`,
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          if (response.status === 403) {
            setAccessDeniedError(true);
            setProducts(errorData?.cards || []);
            setTotalPages(errorData?.totalPages || 0);
            setTotalItems(errorData?.totalCount || 0);
            console.error("Access Denied (403): User does not have access.");
            return;
          }
          // Try to parse error from response body
          console.error("API Error Response:", errorData);
          throw new Error(
            `Failed to fetch products: ${response.statusText} ${errorData?.details ? `- ${errorData.details}` : ""}`,
          );
        }
        const data = await response.json();
        if (data.canAccessCompetitive === false) {
          setAccessDeniedError(true);
        }
        setProducts(data.products);
        setTotalPages(data.totalPages);
        setTotalItems(data.totalCount);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
        setTotalPages(0);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    };
    fetchProductsData();
  }, [
    selectedCategory,
    selectedGroups,
    currentPage,
    itemsPerPage,
    priceRange,
    searchTerm,
    productType,
    rarities,
    sortColumn,
    sortDirection,
  ]);

  const renderSortIcon = (columnKey: string) => {
    if (sortColumn === columnKey) {
      return sortDirection === "asc" ? (
        <ArrowUp className="ml-1 h-4 w-4" />
      ) : (
        <ArrowDown className="ml-1 h-4 w-4" />
      );
    }
    return null;
  };

  const getClassColor = (price: number | null): string => {
    if (price === null) {
      return "text-muted-foreground"; // Theme-aware neutral color for null prices
    }
    return price > 0
      ? "text-green-600 dark:text-green-400"
      : price < 0
        ? "text-red-600 dark:text-red-400"
        : "text-foreground"; // Theme-aware text color for zero values
  };

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background pb-4">
        <div className="mb-4 space-y-4">
          {/* Game tabs */}
          <div className="border-b">
            <div className="flex space-x-6 overflow-x-auto">
              {categoryOptions.map((game) => (
                <button
                  key={game.label}
                  onClick={() => handleCategoryChange(game)}
                  className={cn(
                    "relative flex items-center py-2 text-sm font-medium transition-colors focus-visible:outline-none",
                    selectedCategory.label === game.label
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary",
                  )}
                  disabled={game.disabled}
                >
                  {game.imageSrc ? (
                    <Image
                      src={game.imageSrc}
                      alt={game.label}
                      width={20}
                      height={20}
                      className="mr-2"
                    />
                  ) : (
                    <ShapesIcon
                      className="mr-2 h-[20px] w-[20px]"
                      aria-label="Default category icon"
                    />
                  )}
                  {game.label}
                  {selectedCategory.label === game.label && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          {/* Search input on the left */}
          <div className="relative w-full max-w-md md:w-auto md:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 transform p-0 hover:bg-gray-200"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* All dropdowns on the right */}
          <div className="flex flex-wrap items-center gap-1 md:gap-2">
            <div>
              <Select
                value={selectedGroups[0] || ""}
                onValueChange={(value: string) => {
                  setSelectedGroups(value ? [value] : []);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Set" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.setEras.map((era) => (
                    <SelectItem
                      key={String(era.value)}
                      value={String(era.value)}
                    >
                      {era.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={productType[0] || ""}
                onValueChange={(value: string) => {
                  setProductType(value ? [value] : []);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((type) => (
                    <SelectItem
                      key={String(type.value)}
                      value={String(type.value)}
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FilterDropdown
              triggerLabel="Price"
              triggerLabelDesktop="Price Range"
              options={[
                { value: ANY_PRICE_RANGE, label: ANY_PRICE_RANGE_LABEL },
                { value: "0-5", label: "Under $5" },
                { value: "5-20", label: "$5 - $20" },
                { value: "20+", label: "Over $20" },
              ]}
              onChange={(value) => {
                setPriceRange(value);
                setCurrentPage(1);
              }}
              value={priceRange}
            />
            <div>
              <Select
                value={rarities[0] || ""}
                onValueChange={(value: string) => {
                  setRarities([value]);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.rarities.map((r) => (
                    <SelectItem key={String(r.value)} value={String(r.value)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FilterDropdown
              triggerLabel="Page"
              triggerLabelDesktop="Items per page"
              options={[
                { value: "10", label: "10" },
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
              onChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
              value={String(itemsPerPage)}
            />
          </div>
        </div>
        {accessDeniedError && (
          <AccessDeniedBanner className="mx-4 sm:mx-0" />
        )}{" "}
      </div>
      <div className="relative">
        {" "}
        {/* Positioning context for the overlay */}
        <div>
          {" "}
          {/* Wrapper for table content, gets blurred */}
          {loading ? (
            <div className="flex h-[calc(100vh-400px)] items-center justify-center">
              {/* <LoadingOverlay fullPage={false} />  */} Loading...
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Card Name
                        {renderSortIcon("name")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("set_name")}
                    >
                      <div className="flex items-center">
                        Set
                        {renderSortIcon("set_name")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("market_price")}
                    >
                      <div className="flex items-center">
                        Current Price
                        {renderSortIcon("market_price")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("diff_market_price")}
                    >
                      <div className="flex items-center">
                        % Change
                        {renderSortIcon("diff_market_price")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("dollar_diff_market_price")}
                    >
                      <div className="flex items-center">
                        $ Change
                        {renderSortIcon("dollar_diff_market_price")}
                      </div>
                    </TableHead>
                    <TableHead className="w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const curr = Number(product.marketPrice) ?? 0;
                    const colorClass = getClassColor(product.diffMarketPrice);

                    // Use encodeURIComponent to safely escape subTypeName for URLs
                    const subTypeSlug = product.subTypeName
                      ? encodeURIComponent(product.subTypeName.trim())
                      : "normal";
                    const productDetailsUrl = `/home/product/${product.productId}/${subTypeSlug}`;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <a
                            href={productDetailsUrl || "#"}
                            className="link link-primary block max-w-[150px] truncate font-medium"
                            onMouseEnter={() =>
                              setPreviewImageUrl(product.imageUrl ?? "")
                            }
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setPreviewImageUrl("")}
                          >
                            <img
                              src={product.imageUrl ?? ""}
                              alt={product.name ?? ""}
                              className={cn("h-12 w-auto object-contain", {
                                "select-none blur-[2px] filter":
                                  accessDeniedError,
                              })}
                              onError={(e) => {
                                e.currentTarget.src =
                                  "/images/img-not-found.png";
                              }}
                            />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div
                            className={cn("flex flex-col", {
                              "select-none blur-[3px] filter":
                                accessDeniedError,
                            })}
                          >
                            <div className="flex items-center gap-2">
                              <a
                                href={productDetailsUrl || "#"}
                                className="link link-primary flex-1 truncate font-medium"
                                onMouseEnter={() =>
                                  setPreviewImageUrl(product.imageUrl ?? "")
                                }
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setPreviewImageUrl("")}
                              >
                                {product.name}
                              </a>
                            </div>
                            <div className="flex gap-3 pt-1">
                              {product.rarity && (
                                <div
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getRarityStyle(
                                    product.rarity,
                                  )}`}
                                >
                                  {getRarityInitials(product.rarity)}
                                </div>
                              )}
                              {product.subTypeName && (
                                <span className="block text-sm text-opacity-70">
                                  {product.subTypeName}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn({
                              "select-none blur-[3px] filter":
                                accessDeniedError,
                            })}
                          >
                            {product.setName ?? ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn({
                              "select-none blur-[3px] filter":
                                accessDeniedError,
                            })}
                          >
                            ${curr.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(colorClass, {
                              "select-none blur-[3px] filter":
                                accessDeniedError, // Re-apply conditional blur
                            })}
                          >
                            {(product.diffMarketPrice
                              ? product.diffMarketPrice * 100
                              : 0
                            ).toFixed(2)}
                            %
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(colorClass, {
                              "select-none blur-[3px] filter":
                                accessDeniedError, // Re-apply conditional blur
                            })}
                          >
                            ${product.dollarDiffMarketPrice?.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {product.url && (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                }),
                                "h-8 min-w-[88px] px-3 text-xs",
                              )}
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Buy
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="my-4 flex w-full justify-center">
                <div className="flex items-center space-x-2">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="mb-4 text-center text-sm text-opacity-60">
                Showing {products.length} of {totalItems} products
              </div>
            </>
          )}
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt="Preview"
              className="pointer-events-none fixed z-50 border border-gray-200 bg-white shadow-lg"
              style={{
                top: previewY,
                left: previewX,
                maxWidth: PREVIEW_MAX_WIDTH,
                maxHeight: PREVIEW_MAX_HEIGHT,
                width: "auto",
                height: "auto",
              }}
              width={PREVIEW_MAX_WIDTH}
              height={PREVIEW_MAX_HEIGHT}
              onError={() => setPreviewImageUrl("/images/img-not-found.png")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyTrendsClientComponent;
