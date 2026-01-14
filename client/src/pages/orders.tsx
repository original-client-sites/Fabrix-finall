import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Package, QrCode, CalendarIcon, Minus, DollarSign, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrderDialog } from "@/components/create-order-dialog";
import { OrderCard } from "@/components/order-card";
import { QRScannerDialog } from "@/components/qr-scanner-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";

import type { OrderWithItems } from "@shared/schema";

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"latest" | "oldest" | "amount_high" | "amount_low" | "customer_name">("latest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");

  const { data: orders = [], isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  // Get unique payment methods from orders
  const paymentMethods = Array.from(new Set(orders.map(order => order.paymentMethod))).filter(Boolean).sort();

  const filteredAndSortedOrders = [...orders].filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      selectedStatus === "all" || order.status === selectedStatus;
    
    // Date range filter
    const matchesDate = (!startDate || !order.date || new Date(order.date) >= new Date(startDate)) && 
                       (!endDate || !order.date || new Date(order.date) <= new Date(endDate));
    
    // Amount range filter
    const orderAmount = parseFloat(order.totalAmount);
    const matchesAmount = (!minAmount || orderAmount >= parseFloat(minAmount)) && 
                        (!maxAmount || orderAmount <= parseFloat(maxAmount));
    
    // Payment method filter
    const matchesPaymentMethod = paymentMethod === "all" || order.paymentMethod === paymentMethod;
    
    return matchesSearch && matchesStatus && matchesDate && matchesAmount && matchesPaymentMethod;
  }).sort((a, b) => {
    switch (sortBy) {
      case "latest":
        // Sort by date descending (latest first)
        const dateA = a.date ? (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()) : 0;
        const dateB = b.date ? (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()) : 0;
        return dateB - dateA; // Higher timestamp first
      case "oldest":
        // Sort by date ascending (oldest first)
        const dateA2 = a.date ? (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()) : 0;
        const dateB2 = b.date ? (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()) : 0;
        return dateA2 - dateB2; // Lower timestamp first
      case "amount_high":
        return parseFloat(b.totalAmount) - parseFloat(a.totalAmount);
      case "amount_low":
        return parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
      case "customer_name":
        return a.customerName.localeCompare(b.customerName);
      default:
        return 0;
    }
  });

  const statuses = [
    { value: "all", label: "All Orders" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const handleScan = (result: string) => {
    // Logic to handle scanned QR code (e.g., find product by code)
    console.log("Scanned:", result);
    setIsScannerOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
                  Orders
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and track your orders
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsScannerOpen(true)}
                  variant="outline"
                  data-testid="button-scan-product"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Scan Product
                </Button>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  data-testid="button-create-order"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Order
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by number or customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-orders"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {statuses.map((status) => (
                <Badge
                  key={status.value}
                  variant={selectedStatus === status.value ? "default" : "outline"}
                  className="cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => setSelectedStatus(status.value)}
                  data-testid={`badge-status-${status.value}`}
                >
                  {status.label}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Date Range Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Date Range
                    {(startDate || endDate) && (
                      <span className="ml-1 text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {startDate && `From: ${new Date(startDate).toLocaleDateString()}`} 
                        {endDate && ` To: ${new Date(endDate).toLocaleDateString()}`}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 p-4" align="start">
                  <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="start-date">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="start-date"
                            variant="outline"
                            className="w-full justify-start text-left font-normal mt-1"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? new Date(startDate).toLocaleDateString() : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate ? new Date(startDate) : undefined}
                            onSelect={(date) => setStartDate(date ? date.toISOString().split('T')[0] : "")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="end-date"
                            variant="outline"
                            className="w-full justify-start text-left font-normal mt-1"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? new Date(endDate).toLocaleDateString() : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate ? new Date(endDate) : undefined}
                            onSelect={(date) => setEndDate(date ? date.toISOString().split('T')[0] : "")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Amount Range Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Amount Range
                    {(minAmount || maxAmount) && (
                      <span className="ml-1 text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {minAmount && `Min: ${minAmount}`} 
                        {maxAmount && `Max: ${maxAmount}`}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-4" align="start">
                  <DropdownMenuLabel>Amount Range</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="min-amount">Minimum Amount</Label>
                      <Input
                        id="min-amount"
                        type="number"
                        placeholder="Min amount"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-amount">Maximum Amount</Label>
                      <Input
                        id="max-amount"
                        type="number"
                        placeholder="Max amount"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Payment Method Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Method
                    {paymentMethod !== "all" && (
                      <span className="ml-1 text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {paymentMethod?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="start">
                  <DropdownMenuLabel>Payment Method</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPaymentMethod("all")}>
                    All Methods
                  </DropdownMenuItem>
                  {paymentMethods.map(method => (
                    <DropdownMenuItem 
                      key={method} 
                      onClick={() => setPaymentMethod(method)}
                    >
                      {method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Sort By */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Minus className="h-4 w-4 rotate-90" />
                    Sort By
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortBy("latest")}>Latest First</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("oldest")}>Oldest First</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("amount_high")}>Highest Amount</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("amount_low")}>Lowest Amount</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("customer_name")}>Customer Name</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-order-count">
              {filteredAndSortedOrders.length} {filteredAndSortedOrders.length === 1 ? "order" : "orders"}
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-md" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedOrders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Package className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">
                  No orders found
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {searchQuery || selectedStatus !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Get started by creating your first order"}
                </p>
                {!searchQuery && selectedStatus === "all" && (
                  <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-order">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Order
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredAndSortedOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateOrderDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
      <QRScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onProductScanned={(product) => {
          console.log("Scanned product:", product);
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
}