import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { X, Upload, Sparkles, Calendar as CalendarIcon } from "lucide-react";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertProductSchema, type Product, type InsertProduct } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const [currentTab, setCurrentTab] = useState("basic");
  const [tagInput, setTagInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      productName: product?.productName ?? "",
      sku: product?.sku ?? "",
      category: product?.category ?? "",
      brand: product?.brand ?? "",
      description: product?.description ?? "",
      color: product?.color ?? "",
      size: product?.size ?? "",
      fabric: product?.fabric ?? "",
      pattern: product?.pattern ?? "",
      price: product?.price?.toString() ?? "0",
      costPrice: product?.costPrice?.toString() ?? "",
      stockQuantity: product?.stockQuantity ?? 0,
      warehouse: product?.warehouse ?? "",
      productImage: product?.productImage ?? "",
      galleryImages: product?.galleryImages ? (typeof product.galleryImages === 'string' ? JSON.parse(product.galleryImages) : product.galleryImages) : [],
      isFeatured: product?.isFeatured ?? false,
      launchDate: product?.launchDate ?? undefined,
      rating: product?.rating ?? "",
      tags: product?.tags ? (typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags) : [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: product ? "Product updated successfully" : "Product created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return await apiRequest("PATCH", `/api/products/${product?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProduct) => {
    if (product) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const generateSKU = () => {
    const productName = form.getValues("productName");
    if (!productName || productName.trim() === "") {
      // Fallback to random SKU if no product name
      const sku = `SKU-${nanoid(8).toUpperCase()}`;
      form.setValue("sku", sku);
      return;
    }
    
    // Convert product name to SKU format: lowercase, replace spaces with hyphens
    const sku = productName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''); // Remove special characters except hyphens
    
    form.setValue("sku", sku);
  };

  const addTag = () => {
    if (tagInput.trim()) {
      const currentTags = (form.getValues("tags") as unknown as string[]) || [];
      const newTags = [...currentTags, tagInput.trim()];
      form.setValue("tags", newTags as any);
      setTagInput("");
    }
  };

  const removeTag = (index: number) => {
    const currentTags = (form.getValues("tags") as unknown as string[]) || [];
    const newTags = currentTags.filter((_, i) => i !== index);
    form.setValue("tags", newTags as any);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-product">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {product ? "Edit Product" : "Create New Product"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" data-testid="tab-basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing & Stock</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  {...form.register("productName")}
                  placeholder="e.g., Men's Cotton T-Shirt"
                  data-testid="input-product-name"
                />
                {form.formState.errors.productName && (
                  <p className="text-sm text-destructive">{form.formState.errors.productName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Product Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    {...form.register("sku")}
                    placeholder="e.g., SKU-12345"
                    className="flex-1 font-mono"
                    data-testid="input-sku"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateSKU}
                    data-testid="button-generate-sku"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>
                {form.formState.errors.sku && (
                  <p className="text-sm text-destructive">{form.formState.errors.sku.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={form.watch("category")}
                    onValueChange={(value) => form.setValue("category", value)}
                  >
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T-shirt">T-shirt</SelectItem>
                      <SelectItem value="Shirt">Shirt</SelectItem>
                      <SelectItem value="Jeans">Jeans</SelectItem>
                      <SelectItem value="Full sleeve t-shirt">Full sleeve t-shirt</SelectItem>
                      <SelectItem value="Lean paint">Lean paint</SelectItem>
                      <SelectItem value="Polo T-shirt">Polo T-shirt</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.category && (
                    <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    {...form.register("brand")}
                    placeholder="e.g., Nike, Adidas"
                    data-testid="input-brand"
                  />
                  {form.formState.errors.brand && (
                    <p className="text-sm text-destructive">{form.formState.errors.brand.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color *</Label>
                  <Input
                    id="color"
                    {...form.register("color")}
                    placeholder="e.g., Red, Blue, Black"
                    data-testid="input-color"
                  />
                  {form.formState.errors.color && (
                    <p className="text-sm text-destructive">{form.formState.errors.color.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size">Size *</Label>
                  <Input
                    id="size"
                    {...form.register("size")}
                    placeholder="e.g., S, M, L, XL"
                    data-testid="input-size"
                  />
                  {form.formState.errors.size && (
                    <p className="text-sm text-destructive">{form.formState.errors.size.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Describe the product..."
                  rows={4}
                  data-testid="input-description"
                />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="price"
                      {...form.register("price")}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      data-testid="input-price"
                    />
                  </div>
                  {form.formState.errors.price && (
                    <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="costPrice"
                      {...form.register("costPrice")}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      data-testid="input-cost-price"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Stock Quantity *</Label>
                  <Input
                    id="stockQuantity"
                    {...form.register("stockQuantity", { valueAsNumber: true })}
                    type="number"
                    placeholder="0"
                    data-testid="input-stock-quantity"
                  />
                  {form.formState.errors.stockQuantity && (
                    <p className="text-sm text-destructive">{form.formState.errors.stockQuantity.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouse">Warehouse</Label>
                  <Input
                    id="warehouse"
                    {...form.register("warehouse")}
                    placeholder="e.g., Main Warehouse"
                    data-testid="input-warehouse"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit">
              {isPending ? "Saving..." : product ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
