import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Plus, Search, Package, Scan, Clock } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertOrderSchema, type Product, type InsertOrder } from "@shared/schema";
import { QRScannerDialog } from "./qr-scanner-dialog";

interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProduct?: Product | null;
}

export function CreateOrderDialog({ open, onOpenChange, initialProduct }: CreateOrderDialogProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [discountMethod, setDiscountMethod] = useState<'none' | 'percentage' | 'amount' | 'total'>('none');
  const { toast } = useToast();

  // Auto-add scanned product
  useEffect(() => {
    if (initialProduct && open) {
      addProduct(initialProduct);
    }
  }, [initialProduct, open]);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      status: "pending",
      paymentMethod: undefined, // Initialize paymentMethod
      notes: "",
      subTotal: "0",
      discountPercentage: "",
      discountAmount: "",
      totalAmount: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertOrder & { items: OrderItem[] }) => {
      return await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Order created successfully",
      });
      onOpenChange(false);
      form.reset();
      setOrderItems([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addProduct = (product: Product) => {
    if (product.stockQuantity === 0) {
      toast({
        title: "Out of Stock",
        description: `₹{product.productName} is currently out of stock`,
        variant: "destructive",
      });
      return;
    }

    const existingItem = orderItems.find((item) => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stockQuantity) {
        toast({
          title: "Stock Limit Reached",
          description: `Only ₹{product.stockQuantity} units available for ${product.productName}`,
          variant: "destructive",
        });
        return;
      }
      updateQuantity(product.id, existingItem.quantity + 1);
      toast({
        title: "Product Updated",
        description: `${product.productName} quantity increased to ${existingItem.quantity + 1}`,
      });
    } else {
      const newItem: OrderItem = {
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        unitPrice: product.price,
        quantity: 1,
        subtotal: product.price,
      };
      setOrderItems([...orderItems, newItem]);
      toast({
        title: "Product Added",
        description: `${product.productName} added to order`,
      });
    }
    setSearchOpen(false);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;

    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stockQuantity) {
      toast({
        title: "Stock Limit Reached",
        description: `Only ${product.stockQuantity} units available for ${product.productName}`,
        variant: "destructive",
      });
      return;
    }

    setOrderItems(
      orderItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity,
              subtotal: (parseFloat(item.unitPrice) * quantity).toFixed(2),
            }
          : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter((item) => item.productId !== productId));
  };

  const calculateSubTotal = () => {
    return orderItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0).toFixed(2);
  };

  const calculateTotal = () => {
    const subTotal = parseFloat(calculateSubTotal());
    
    if (discountMethod === 'percentage') {
      const discountPercentage = parseFloat(form.watch('discountPercentage') || '0');
      return (subTotal - (subTotal * discountPercentage / 100)).toFixed(2);
    } else if (discountMethod === 'amount') {
      const discountAmount = parseFloat(form.watch('discountAmount') || '0');
      return (subTotal - discountAmount).toFixed(2);
    } else if (discountMethod === 'total') {
      // When setting total directly, we don't recalculate
      return form.watch('totalAmount') || subTotal.toFixed(2);
    } else {
      return subTotal.toFixed(2);
    }
  };

  const onSubmit = (data: InsertOrder) => {
    console.log("Form data on submit:", data);
    console.log("Payment method from form state:", form.getValues("paymentMethod"));
    
    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the order",
        variant: "destructive",
      });
      return;
    }
    
    // Validate that a payment method is selected
    if (!data.paymentMethod || data.paymentMethod.trim() === "") {
      toast({
        title: "Error",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    const subTotal = parseFloat(calculateSubTotal());
    const finalTotal = parseFloat(calculateTotal());
    
    let discountAmount = 0;
    let discountPercentage = 0;
    
    if (discountMethod === 'percentage') {
      discountPercentage = parseFloat(data.discountPercentage || '0');
      discountAmount = (subTotal * discountPercentage) / 100;
    } else if (discountMethod === 'amount') {
      discountAmount = parseFloat(data.discountAmount || '0');
      discountPercentage = (discountAmount / subTotal) * 100;
    } else if (discountMethod === 'total') {
      discountAmount = subTotal - finalTotal;
      discountPercentage = (discountAmount / subTotal) * 100;
    }
    
    const orderData = {
      ...data,
      subTotal: subTotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      discountPercentage: discountPercentage.toFixed(2),
      totalAmount: finalTotal.toFixed(2),
      items: orderItems,
    };
    
    console.log("DEBUG: Final order data being sent:", orderData);
    createMutation.mutate(orderData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-order">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New Order</DialogTitle>
          <DialogDescription>
            Fill in customer details and add products to create a new order
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  {...form.register("customerName")}
                  placeholder="John Doe"
                  data-testid="input-customer-name"
                />
                {form.formState.errors.customerName && (
                  <p className="text-sm text-destructive">{form.formState.errors.customerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  {...form.register("customerEmail")}
                  type="email"
                  placeholder="john@example.com"
                  data-testid="input-customer-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  {...form.register("customerPhone")}
                  placeholder="+1 234 567 8900"
                  data-testid="input-customer-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as InsertOrder["status"])}
                >
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.status && (
                  <p className="text-sm text-destructive">{form.formState.errors.status.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={form.watch("paymentMethod") || ""}
                  onValueChange={(value) => {
                    console.log("Payment method changed to:", value);
                    form.setValue("paymentMethod", value as InsertOrder["paymentMethod"]);
                  }}
                >
                  <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.paymentMethod && (
                  <p className="text-sm text-destructive">{form.formState.errors.paymentMethod.message}</p>
                )}
              </div>

              {/* Discount Section */}
              <div className="col-span-2 space-y-4 mt-4">
                <h3 className="font-semibold text-lg">Discount Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Discount Type</Label>
                    <Select
                      value={discountMethod}
                      onValueChange={(value: 'none' | 'percentage' | 'amount' | 'total') => {
                        setDiscountMethod(value);
                        if (value === 'none') {
                          form.setValue('discountPercentage', '');
                          form.setValue('discountAmount', '');
                          form.setValue('totalAmount', calculateSubTotal());
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select discount type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="percentage">By Percentage</SelectItem>
                        <SelectItem value="amount">By Fixed Amount</SelectItem>
                        <SelectItem value="total">Set Total Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="subTotal">Sub Total</Label>
                    <Input
                      id="subTotal"
                      readOnly
                      value={`$${calculateSubTotal()}`}
                      placeholder="Sub Total"
                    />
                  </div>
                  
                  {discountMethod === 'percentage' && (
                    <div>
                      <Label htmlFor="discountPercentage">Discount %</Label>
                      <Input
                        id="discountPercentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...form.register("discountPercentage", {
                          onChange: (e) => {
                            const value = e.target.value;
                            form.setValue('discountPercentage', value);
                            if (value) {
                              const subTotal = parseFloat(calculateSubTotal());
                              const discountAmount = (subTotal * parseFloat(value)) / 100;
                              form.setValue('discountAmount', discountAmount.toFixed(2));
                              form.setValue('totalAmount', (subTotal - discountAmount).toFixed(2));
                            }
                          }
                        })}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  
                  {discountMethod === 'amount' && (
                    <div>
                      <Label htmlFor="discountAmount">Discount Amount</Label>
                      <Input
                        id="discountAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={parseFloat(calculateSubTotal())}
                        {...form.register("discountAmount", {
                          onChange: (e) => {
                            const value = e.target.value;
                            form.setValue('discountAmount', value);
                            if (value) {
                              const subTotal = parseFloat(calculateSubTotal());
                              const discountPercent = (parseFloat(value) / subTotal) * 100;
                              form.setValue('discountPercentage', discountPercent.toFixed(2));
                              form.setValue('totalAmount', (subTotal - parseFloat(value)).toFixed(2));
                            }
                          }
                        })}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  
                  {discountMethod === 'total' && (
                    <div>
                      <Label htmlFor="totalAmount">Final Total</Label>
                      <Input
                        id="totalAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={parseFloat(calculateSubTotal())}
                        {...form.register("totalAmount", {
                          onChange: (e) => {
                            const value = e.target.value;
                            form.setValue('totalAmount', value);
                            if (value) {
                              const subTotal = parseFloat(calculateSubTotal());
                              const discountAmount = subTotal - parseFloat(value);
                              const discountPercent = (discountAmount / subTotal) * 100;
                              form.setValue('discountAmount', discountAmount.toFixed(2));
                              form.setValue('discountPercentage', discountPercent.toFixed(2));
                            }
                          }
                        })}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Products</h3>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setScannerOpen(true)}
                  data-testid="button-scan-product"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Scan Product
                </Button>
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" data-testid="button-add-product">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandList>
                        <CommandEmpty>No products found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              onSelect={() => addProduct(product)}
                              data-testid={`command-item-${product.id}`}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {product.productImage ? (
                                    <img
                                      src={product.productImage}
                                      alt={product.productName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{product.productName}</p>
                                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                                </div>
                                <p className="font-semibold">${product.price}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {orderItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-no-items">
                    No products added yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {orderItems.map((item, index) => (
                      <div key={item.productId} className="p-4" data-testid={`order-item-${index}`}>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-muted-foreground font-mono">{item.sku}</p>
                            <p className="text-xs text-muted-foreground">
                              Available: {products.find(p => p.id === item.productId)?.stockQuantity || 0} units
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                data-testid={`button-decrease-qty-${index}`}
                              >
                                -
                              </Button>
                              <span className="w-12 text-center font-medium" data-testid={`text-qty-${index}`}>
                                {item.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= (products.find(p => p.id === item.productId)?.stockQuantity || 0)}
                                data-testid={`button-increase-qty-${index}`}
                              >
                                +
                              </Button>
                            </div>
                            <p className="font-semibold w-20 text-right" data-testid={`text-subtotal-${index}`}>
                              ₹{item.subtotal}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.productId)}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-muted/50 border-t flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">Subtotal</p>
                      <p className="text-sm text-muted-foreground">${calculateSubTotal()}</p>
                    </div>
                    {discountMethod !== 'none' && (
                      <div className="text-right">
                        <p className="font-semibold text-lg">Discount</p>
                        <p className="text-sm text-muted-foreground">
                          {discountMethod === 'percentage' && `${form.watch('discountPercentage')}% off`}
                          {discountMethod === 'amount' && `$${form.watch('discountAmount')} off`}
                          {discountMethod === 'total' && `$${(parseFloat(calculateSubTotal()) - parseFloat(form.watch('totalAmount') || '0')).toFixed(2)} saved`}
                        </p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="font-semibold text-lg">Total</p>
                      <p className="font-bold text-2xl" data-testid="text-order-total">
                        ₹{calculateTotal()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Add any special instructions or notes..."
              rows={3}
              data-testid="input-notes"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Clock className="h-4 w-4" />
              <span>Order Date: {formatInIST(new Date(), "MMM dd, yyyy HH:mm:ss")}</span>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setOrderItems([]);
                }}
                disabled={createMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || orderItems.length === 0}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <QRScannerDialog 
        open={scannerOpen} 
        onOpenChange={setScannerOpen}
        onProductScanned={(product) => {
          addProduct(product);
          setScannerOpen(false);
        }}
      />
    </Dialog>
  );
}