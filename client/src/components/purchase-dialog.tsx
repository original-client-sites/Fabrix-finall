import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Package, ShoppingCart, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

const purchaseFormSchema = z.object({
  type: z.enum(["purchase", "purchaseReturn"]),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});

type PurchaseFormData = z.infer<typeof purchaseFormSchema>;

export function PurchaseDialog({ open, onOpenChange, product }: PurchaseDialogProps) {
  const { toast } = useToast();
  const [movementType, setMovementType] = useState<"purchase" | "purchaseReturn">("purchase");

  // Fetch movements to calculate available stock
  const { data: movements = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-movements"],
  });

  // Calculate available stock using the same logic as stock history table
  const calculatedAvailableStock = useMemo(() => {
    if (!product) return 0;
    
    // Get all movements for this product
    const productMovements = movements.filter(m => m.productId === product.id);
    
    // Calculate: Available = Initial Stock + Purchased + Returned - Sold - Purchase Return
    let initialStock = 0;
    let purchased = 0;
    let returned = 0;
    let sold = 0;
    let purchaseReturn = 0;
    
    productMovements.forEach(m => {
      const reasonLower = m.reason.toLowerCase();
      
      switch (m.type) {
        case "in":
          if (reasonLower.includes("initial stock")) {
            initialStock += m.quantity;
          } else if (reasonLower.includes("purchase")) {
            purchased += m.quantity;
          } else if (reasonLower.includes("return")) {
            returned += m.quantity;
          } else {
            purchased += m.quantity;
          }
          break;
        case "out":
          if (reasonLower.includes("sale")) {
            sold += m.quantity;
          } else if (reasonLower.includes("purchase return") || reasonLower.includes("supplier return")) {
            purchaseReturn += m.quantity;
          } else {
            sold += m.quantity;
          }
          break;
        case "adjustment":
          // Treat adjustment as reset - add the difference
          const currentCalculated = initialStock + purchased + returned - sold - purchaseReturn;
          const difference = m.quantity - currentCalculated;
          if (difference > 0) {
            // Positive adjustment adds to stock
            purchased += difference;
          } else {
            // Negative adjustment reduces stock (treat as additional sold)
            sold += Math.abs(difference);
          }
          break;
      }
    });
    
    const available = initialStock + purchased + returned - sold - purchaseReturn;
    return Math.max(0, available); // Ensure non-negative
  }, [product, movements]);

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      type: "purchase",
      quantity: 1,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseFormData) => {
      if (!product) throw new Error("No product selected");
      
      const movementData: InsertStockMovement = {
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        type: data.type === "purchase" ? "in" : "out",
        quantity: data.quantity,
        reason: data.type === "purchase" ? "Purchase" : "Purchase Return",
        notes: data.notes || `Product ${data.type === "purchase" ? "purchased" : "purchase returned"}`,
      };
      
      return await apiRequest("POST", "/api/stock-movements", movementData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      toast({
        title: "Success",
        description: `Successfully recorded ${movementType === "purchase" ? "purchase" : "purchase return"} of ${form.getValues("quantity")} units`,
      });
      onOpenChange(false);
      form.reset();
      setMovementType("purchase");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record purchase movement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PurchaseFormData) => {
    createMutation.mutate(data);
  };

  const handleTypeChange = (value: "purchase" | "purchaseReturn") => {
    setMovementType(value);
    form.setValue("type", value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-purchase">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {movementType === "purchase" ? (
              <>
                <ShoppingCart className="h-6 w-6 text-green-600" />
                Record Purchase
              </>
            ) : (
              <>
                <RotateCcw className="h-6 w-6 text-red-600" />
                Record Purchase Return
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {movementType === "purchase" 
              ? "Record new purchases from suppliers" 
              : "Record returns to suppliers"}
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="p-4 bg-muted rounded-lg mb-4">
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
                  Current Stock: <span className="font-semibold">{calculatedAvailableStock}</span> units
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="type">Transaction Type *</Label>
            <Select
              value={movementType}
              onValueChange={handleTypeChange}
            >
              <SelectTrigger id="type" data-testid="select-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-green-600" />
                    <span>New Purchase</span>
                  </div>
                </SelectItem>
                <SelectItem value="purchaseReturn">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-red-600" />
                    <span>Purchase Return</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity *
            </Label>
            <Input
              id="quantity"
              {...form.register("quantity", { valueAsNumber: true })}
              type="number"
              min="1"
              placeholder="Enter quantity"
              data-testid="input-quantity"
            />
            {form.formState.errors.quantity && (
              <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
            )}
            {product && (
              <p className="text-sm text-muted-foreground">
                {movementType === "purchase" && `New stock will be: ${calculatedAvailableStock + (form.watch("quantity") || 0)} units`}
                {movementType === "purchaseReturn" && `New stock will be: ${Math.max(0, calculatedAvailableStock - (form.watch("quantity") || 0))} units`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              {...form.register("notes")}
              placeholder={`Add notes about this ${movementType === "purchase" ? "purchase" : "purchase return"}...`}
              data-testid="input-notes"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setMovementType("purchase");
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
                {createMutation.isPending 
                  ? "Recording..." 
                  : movementType === "purchase" 
                    ? "Record Purchase" 
                    : "Record Purchase Return"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}