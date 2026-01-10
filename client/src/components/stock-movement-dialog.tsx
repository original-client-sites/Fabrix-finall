import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Package, TrendingUp, TrendingDown, RefreshCw, Clock } from "lucide-react";
import { format } from "date-fns";
import { formatInIST } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertStockMovementSchema, type Product, type InsertStockMovement } from "@shared/schema";
import { z } from "zod";

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function StockMovementDialog({ open, onOpenChange, product }: StockMovementDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const { toast } = useToast();

  // Auto-select scanned product
  useEffect(() => {
    if (product && open) {
      setSelectedProductId(product.id);
      form.setValue("productId", product.id);
    }
  }, [product, open]);

  const form = useForm<InsertStockMovement>({
    resolver: zodResolver(insertStockMovementSchema),
    defaultValues: {
      productId: product?.id || "",
      productName: product?.productName || "",
      sku: product?.sku || "",
      type: "in",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertStockMovement) => {
      return await apiRequest("POST", "/api/stock-movements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      toast({
        title: "Success",
        description: "Stock movement recorded successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record stock movement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertStockMovement) => {
    createMutation.mutate(data);
  };

  const movementType = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-stock-movement">
        <DialogHeader>
          <DialogTitle className="text-2xl">Record Stock Movement</DialogTitle>
          <DialogDescription>
            Add, remove, or adjust stock quantities for this product
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {product && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-md bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
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
                  <h3 className="font-semibold text-lg" data-testid="text-product-name">
                    {product.productName}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">SKU: {product.sku}</p>
                  <p className="text-sm text-muted-foreground">
                    Current Stock: <span className="font-semibold">{product.stockQuantity}</span> units
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">Movement Type *</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(value) => form.setValue("type", value as any)}
            >
              <SelectTrigger id="type" data-testid="select-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span>Stock In (Add)</span>
                  </div>
                </SelectItem>
                <SelectItem value="out">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span>Stock Out (Remove)</span>
                  </div>
                </SelectItem>
                <SelectItem value="adjustment">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                    <span>Adjustment (Set to)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              {movementType === "adjustment" ? "New Quantity *" : "Quantity *"}
            </Label>
            <Input
              id="quantity"
              {...form.register("quantity", { valueAsNumber: true })}
              type="number"
              min="1"
              placeholder="0"
              data-testid="input-quantity"
            />
            {form.formState.errors.quantity && (
              <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
            )}
            {product && movementType !== "adjustment" && (
              <p className="text-sm text-muted-foreground">
                {movementType === "in" && `New stock will be: ${product.stockQuantity + (form.watch("quantity") || 0)} units`}
                {movementType === "out" && `New stock will be: ${Math.max(0, product.stockQuantity - (form.watch("quantity") || 0))} units`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select
              value={form.watch("reason")}
              onValueChange={(value) => form.setValue("reason", value)}
            >
              <SelectTrigger id="reason" data-testid="select-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {movementType === "in" && (
                  <>
                    <SelectItem value="Purchase">New Purchase</SelectItem>
                    <SelectItem value="Return">Customer Return</SelectItem>
                    <SelectItem value="Transfer In">Transfer In</SelectItem>
                  </>
                )}
                {movementType === "out" && (
                  <>
                    <SelectItem value="Sale">Sale</SelectItem>
                    <SelectItem value="Damaged">Damaged/Defective</SelectItem>
                    <SelectItem value="Transfer Out">Transfer Out</SelectItem>
                    <SelectItem value="Lost">Lost/Stolen</SelectItem>
                  </>
                )}
                {movementType === "adjustment" && (
                  <>
                    <SelectItem value="Physical Count">Physical Count</SelectItem>
                    <SelectItem value="Correction">Correction</SelectItem>
                    <SelectItem value="Initial Stock">Initial Stock</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.reason && (
              <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Add any additional details..."
              rows={3}
              data-testid="input-notes"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Clock className="h-4 w-4" />
              <span>Recorded at: {formatInIST(new Date(), "MMM dd, yyyy HH:mm:ss")}</span>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                disabled={createMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Recording..." : "Record Movement"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}