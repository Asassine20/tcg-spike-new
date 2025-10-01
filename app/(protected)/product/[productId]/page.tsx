import { ExternalLink } from "lucide-react";

import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/header";

import PriceHistoryChart from "../_components/price-history-chart";
import SubTypeSelect from "../_components/sub-type-select";

async function ProductDetailsPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { subTypeName?: string };
}) {
  const productIdNum = Number(params.productId);
  if (isNaN(productIdNum)) {
    return <div>Error: Invalid productId</div>;
  }

  const subTypeName = searchParams.subTypeName;

  const products = await prisma.product.findMany({
    where: {
      productId: productIdNum,
    },
    include: {
      group: true,
    },
  });

  if (!products || products.length === 0) {
    return <div>Error: Product not found.</div>;
  }

  const product =
    products.find((p) => p.subTypeName === subTypeName) || products[0];

  const subTypeOptions = products
    .map((p) => p.subTypeName)
    .filter((name): name is string => name !== null && name !== undefined);

  if (!product) {
    console.error("*** Error: Product not found.");
    return <div>Error: Product not found.</div>;
  }

  const highResImageUrl = product?.imageUrl?.replace(
    "_200w.jpg",
    "_in_1000x1000.jpg",
  );

  return (
    <>
      <DashboardHeader
        heading={product.name ?? "Product Details"}
        text={product.group?.name ?? "Information about the product."}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          {highResImageUrl && (
            <Card>
              <CardContent className="p-4">
                <img
                  src={highResImageUrl}
                  alt={product.name ?? "Product Image"}
                  className="mx-auto"
                />
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex flex-col space-y-8 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Set Name
                </p>
                <p>{product.group?.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Rarity
                </p>
                <p>{product.rarity}</p>
              </div>
              {subTypeOptions.length > 1 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Product Type
                  </p>
                  <SubTypeSelect
                    options={subTypeOptions}
                    value={product.subTypeName!}
                    productId={productIdNum}
                  />
                </div>
              )}
              <div>
                {product.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    asChild
                  >
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1 size-3" />
                      Buy
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          {subTypeName ? (
            <PriceHistoryChart
              productId={productIdNum}
              subTypeName={subTypeName}
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Please select a product type to view its price history.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ProductDetailsPage;
