
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Plus, Search, Package, Clock } from "lucide-react";
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
import { insertOrderSchema, type Product, type InsertOrder, type DiscountCode, type OrderWithItems } from "@shared/schema";

interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}

interface UseCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: DiscountCode | null;
}

export function UseCreditDialog({ open, onOpenChange, credit }: UseCreditDialogProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [additionalPayment, setAdditionalPayment] = useState("0");
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: previousOrders = [] } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders/customer", credit?.customerEmail],
    enabled: !!credit?.customerEmail,
  });

  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      status: "pending",
      paymentMethod: "store_credit",
      notes: "",
      totalAmount: "0",
    },
  });

  // Pre-fill customer details when credit is selected
  useEffect(() => {
    if (credit && open) {
      form.setValue("customerEmail", credit.customerEmail);
      form.setValue("notes", `Store credit code: ${credit.code}`);
      
      if (previousOrders.length > 0) {
        const mostRecentOrder = previousOrders.sort(
          (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
        )[0];
        
        form.setValue("customerName", mostRecentOrder.customerName);
        if (mostRecentOrder.customerPhone) {
          form.setValue("customerPhone", mostRecentOrder.customerPhone);
        }
        form.setValue("status", mostRecentOrder.status as "pending" | "processing" | "shipped" | "delivered" | "cancelled");
      }
    }
  }, [credit, open, previousOrders]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertOrder & { items: OrderItem[]; creditCode: string; amountUsed: string }) => {
      // Create the order first
      const order = await apiRequest("POST", "/api/orders", data) as OrderWithItems;
      
      // Then use the store credit
      if (data.creditCode && data.amountUsed) {
        await apiRequest("POST", `/api/discount-codes/${data.creditCode}/use`, {
          amountUsed: data.amountUsed,
        });
        
        // Record additional payment as direct income if applicable
        const totalAmount = parseFloat(data.totalAmount);
        const creditUsed = parseFloat(data.amountUsed);
        const additionalPayment = totalAmount - creditUsed;
        
        if (additionalPayment > 0.01) {
          const now = new Date();
          const fiscalYear = now.getFullYear();
          const fiscalMonth = now.getMonth() + 1;
          const fiscalQuarter = Math.ceil(fiscalMonth / 3);
          
          await apiRequest("POST", "/api/accounts", {
            transactionType: "direct_income",
            referenceId: order.id,
            referenceNumber: order.orderNumber,
            revenue: additionalPayment.toFixed(2),
            cost: "0.00",
            profit: additionalPayment.toFixed(2),
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            notes: `Additional payment on store credit order (Credit used: ₹{creditUsed.toFixed(2)})`,
            fiscalYear,
            fiscalMonth,
            fiscalQuarter,
          });
        }
      }
      
      return order;
    },
    onSuccess: async (data, variables) => {
      const creditUsed = parseFloat(variables.amountUsed);
      const totalAmount = parseFloat(variables.totalAmount);
      const additionalPayment = totalAmount - creditUsed;
      
      if (credit) {
        const creditRemaining = parseFloat(credit.amount) - creditUsed;
        if (creditRemaining > 0.01) {
          toast({
            title: "Success",
            description: `Order created successfully. Remaining credit: ₹{creditRemaining.toFixed(2)}`,
          });
        } else {
          toast({
            title: "Success",
            description: "Order created successfully. Store credit fully used.",
          });
        }
        
        if (additionalPayment > 0.01) {
          toast({
            title: "Additional Payment Recorded",
            description: `Additional payment of ₹{additionalPayment.toFixed(2)} recorded as direct income.`,
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discount-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      onOpenChange(false);
      form.reset();
      setOrderItems([]);
      setAdditionalPayment("0");
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
        description: `${product.productName} is currently out of stock`,
        variant: "destructive",
      });
      return;
    }

    const existingItem = orderItems.find((item) => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stockQuantity) {
        toast({
          title: "Stock Limit Reached",
          description: `Only ${product.stockQuantity} units available for ${product.productName}`,
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

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0).toFixed(2);
  };

  const calculatePaymentBreakdown = () => {
    const orderTotal = parseFloat(calculateTotal());
    const creditAmount = credit ? parseFloat(credit.amount) : 0;
    const remaining = Math.max(0, orderTotal - creditAmount);
    const creditUsed = Math.min(orderTotal, creditAmount);
    
    return {
      orderTotal,
      creditAmount,
      creditUsed,
      additionalRequired: remaining,
    };
  };

  const onSubmit = (data: InsertOrder) => {
    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the order",
        variant: "destructive",
      });
      return;
    }

    if (!credit) {
      toast({
        title: "Error",
        description: "No store credit selected",
        variant: "destructive",
      });
      return;
    }

    const breakdown = calculatePaymentBreakdown();
    const additionalPaid = parseFloat(additionalPayment);

    if (additionalPaid < breakdown.additionalRequired) {
      toast({
        title: "Insufficient Payment",
        description: `Please pay the remaining amount of ₹{breakdown.additionalRequired.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    const total = calculateTotal();
    createMutation.mutate({
      ...data,
      totalAmount: total,
      items: orderItems,
      creditCode: credit.code,
      amountUsed: breakdown.creditUsed.toFixed(2),
    });
  };

  const breakdown = calculatePaymentBreakdown();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Use Store Credit</DialogTitle>
          <DialogDescription>
            Create a new order using store credit {credit?.code}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Credit Info */}
          {credit && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Store Credit</p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{parseFloat(credit.amount).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Code</p>
                    <code className="text-sm font-mono">{credit.code}</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  {...form.register("customerName")}
                  placeholder="John Doe"
                />
                {form.formState.errors.customerName && (
                  <p className="text-sm text-destructive">{form.formState.errors.customerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email (Pre-filled)</Label>
                <Input
                  id="customerEmail"
                  {...form.register("customerEmail")}
                  type="email"
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  {...form.register("customerPhone")}
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as any)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Products</h3>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline">
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
                              <p className="font-semibold">₹{product.price}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {orderItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No products added yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {orderItems.map((item) => (
                      <div key={item.productId} className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-muted-foreground font-mono">{item.sku}</p>
                            <p className="text-xs text-muted-foreground">
                              Stock: {products.find(p => p.id === item.productId)?.stockQuantity || 0} units (In cart: {item.quantity})
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
                              >
                                -
                              </Button>
                              <span className="w-12 text-center font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= (products.find(p => p.id === item.productId)?.stockQuantity || 0)}
                              >
                                +
                              </Button>
                            </div>
                            <p className="font-semibold w-20 text-right">
                              ₹{item.subtotal}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.productId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-muted/50 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Order Total:</span>
                      <span className="font-semibold">₹{breakdown.orderTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Store Credit Applied:</span>
                      <span className="font-semibold">-₹{breakdown.creditUsed.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">Additional Payment Required:</span>
                      <span className="font-bold text-lg text-red-600">
                        ₹{breakdown.additionalRequired.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {breakdown.additionalRequired > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="additionalPayment">Additional Payment Amount *</Label>
                <Input
                  id="additionalPayment"
                  type="number"
                  step="0.01"
                  min="0"
                  value={additionalPayment}
                  onChange={(e) => setAdditionalPayment(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the additional payment amount to complete this order
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method (for additional amount) *</Label>
                <Select
                  value={form.watch("paymentMethod")}
                  onValueChange={(value) => form.setValue("paymentMethod", value as any)}
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select payment method for the additional ₹{breakdown.additionalRequired.toFixed(2)}
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Add any special instructions or notes..."
              rows={3}
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
                  setAdditionalPayment("0");
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || orderItems.length === 0}
              >
                {createMutation.isPending ? "Creating..." : "Create Order & Use Credit"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
