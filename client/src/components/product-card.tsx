import { useState } from "react";
import { Edit, Trash2, QrCode, Package, TrendingUp } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductDialog } from "./product-dialog";
import { QRCodeDialog } from "./qr-code-dialog";
import { DeleteProductDialog } from "./delete-product-dialog";
import { StockMovementDialog } from "./stock-movement-dialog";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product;
  viewMode: "grid" | "list";
}

export function ProductCard({ product, viewMode }: ProductCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);

  const stockStatus =
    product.stockQuantity === 0
      ? "out"
      : product.stockQuantity < 10
        ? "low"
        : "in";

  if (viewMode === "list") {
    return (
      <>
        <Card className="hover-elevate" data-testid={`card-product-${product.id}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {product.productImage ? (
                  <img
                    src={product.productImage}
                    alt={product.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-2">
                  <h3 className="font-semibold text-lg truncate" data-testid={`text-product-name-${product.id}`}>
                    {product.productName}
                  </h3>
                  <Badge
                    variant={stockStatus === "out" ? "destructive" : stockStatus === "low" ? "secondary" : "default"}
                    className="flex-shrink-0"
                    data-testid={`badge-stock-${product.id}`}
                  >
                    {stockStatus === "out" ? "Out of Stock" : `${product.stockQuantity} in stock`}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="font-mono" data-testid={`text-sku-${product.id}`}>SKU: {product.sku}</span>
                  <span>•</span>
                  <span data-testid={`text-brand-${product.id}`}>{product.brand}</span>
                  <span>•</span>
                  <span data-testid={`text-category-${product.id}`}>{product.category}</span>
                  <span>•</span>
                  <span>{product.size}</span>
                  <span>•</span>
                  <span>{product.color}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-bold" data-testid={`text-price-${product.id}`}>₹{product.price}</div>
                  {product.costPrice && (
                    <div className="text-xs text-muted-foreground">Cost: ₹{product.costPrice}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsStockDialogOpen(true)}
                    data-testid={`button-stock-${product.id}`}
                    title="Manage Stock"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsQRDialogOpen(true)}
                    data-testid={`button-qr-${product.id}`}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsEditDialogOpen(true)}
                    data-testid={`button-edit-${product.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    data-testid={`button-delete-${product.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProductDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          product={product}
        />
        <QRCodeDialog
          open={isQRDialogOpen}
          onOpenChange={setIsQRDialogOpen}
          product={product}
        />
        <StockMovementDialog
          open={isStockDialogOpen}
          onOpenChange={setIsStockDialogOpen}
          product={product}
        />
        <DeleteProductDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          product={product}
        />
      </>
    );
  }

  return (
    <>
      <Card className="group overflow-hidden hover-elevate" data-testid={`card-product-${product.id}`}>
        <div className="aspect-square bg-muted relative overflow-hidden">
          {product.productImage ? (
            <img
              src={product.productImage}
              alt={product.productName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          <Badge
            variant={stockStatus === "out" ? "destructive" : stockStatus === "low" ? "secondary" : "default"}
            className="absolute top-3 right-3"
            data-testid={`badge-stock-${product.id}`}
          >
            {stockStatus === "out" ? "Out" : product.stockQuantity}
          </Badge>
        </div>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2" data-testid={`text-product-name-${product.id}`}>
            {product.productName}
          </h3>
          <div className="space-y-1 text-sm text-muted-foreground mb-3">
            <p className="font-mono" data-testid={`text-sku-${product.id}`}>SKU: {product.sku}</p>
            <p data-testid={`text-brand-${product.id}`}>{product.brand} • {product.category}</p>
            <p>{product.size} • {product.color}</p>
          </div>
          <div className="text-2xl font-bold" data-testid={`text-price-${product.id}`}>₹{product.price}</div>
          {product.costPrice && (
            <div className="text-xs text-muted-foreground mt-1">Cost: ₹{product.costPrice}</div>
          )}
        </CardContent>
        <CardFooter className="p-6 pt-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setIsStockDialogOpen(true)}
            data-testid={`button-stock-${product.id}`}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Stock
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsQRDialogOpen(true)}
            data-testid={`button-qr-${product.id}`}
          >
            <QrCode className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsEditDialogOpen(true)}
            data-testid={`button-edit-${product.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsDeleteDialogOpen(true)}
            data-testid={`button-delete-${product.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <ProductDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        product={product}
      />
      <QRCodeDialog
        open={isQRDialogOpen}
        onOpenChange={setIsQRDialogOpen}
        product={product}
      />
      <StockMovementDialog
        open={isStockDialogOpen}
        onOpenChange={setIsStockDialogOpen}
        product={product}
      />
      <DeleteProductDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        product={product}
      />
    </>
  );
}
