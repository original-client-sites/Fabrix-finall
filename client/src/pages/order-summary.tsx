import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Download, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { formatInIST } from "../lib/utils";

// Import the date range type from react-day-picker
import { DateRange as DayPickerDateRange } from "react-day-picker";

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentMethod: string;
  notes: string | null;
  subTotal: string;
  discountPercentage: string | null;
  discountAmount: string | null;
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderSummary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DayPickerDateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Filter orders based on search and filters
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customerEmail && order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
    const matchesPaymentMethod = selectedPaymentMethod === "all" || order.paymentMethod === selectedPaymentMethod;
    
    // Date filtering
    if (dateRange?.from && dateRange?.to) {
      const orderDate = new Date(order.createdAt);
      return matchesSearch && matchesStatus && matchesPaymentMethod && 
             orderDate >= dateRange.from && orderDate <= dateRange.to;
    }
    
    return matchesSearch && matchesStatus && matchesPaymentMethod;
  });

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedPaymentMethod("all");
    setDateRange(undefined);
  };

  // Format payment method display
  const formatPaymentMethod = (method: string) => {
    if (!method) return "Cash";
    return method.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  // Format status display
  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200";
      case "shipped":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "processing":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Order Summary</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Comprehensive view of all orders with advanced filtering
                </p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Input
                  placeholder="Search orders by number, customer name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="store_credit">Store Credit</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from || new Date()}
                    selected={dateRange || undefined}
                    onSelect={(range) => {
                      setDateRange(range || undefined);
                      setIsCalendarOpen(false);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap gap-2">
              {(searchQuery || selectedStatus !== "all" || selectedPaymentMethod !== "all" || (dateRange && dateRange.from)) && (
                <>
                  {searchQuery && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <span>Search: {searchQuery}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        className="h-5 w-5 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {selectedStatus !== "all" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <span>Status: {formatStatus(selectedStatus)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStatus("all")}
                        className="h-5 w-5 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {selectedPaymentMethod !== "all" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <span>Payment: {formatPaymentMethod(selectedPaymentMethod)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPaymentMethod("all")}
                        className="h-5 w-5 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {dateRange && dateRange.from && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <span>
                        Date: {dateRange && dateRange.from ? format(dateRange.from, "MMM dd, yyyy") : ''}
                        {dateRange && dateRange.to && ` - ${format(dateRange.to, "MMM dd, yyyy")}`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDateRange(undefined)}
                        className="h-5 w-5 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="flex items-center gap-1"
                  >
                    Clear All
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-5 w-32 mb-2 bg-muted rounded"></div>
                        <div className="h-4 w-48 bg-muted rounded"></div>
                      </div>
                      <div className="h-9 w-24 bg-muted rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <svg
                    className="h-10 w-10 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {searchQuery || selectedStatus !== "all" || selectedPaymentMethod !== "all" || (dateRange && dateRange.from)
                    ? "Try adjusting your search or filter criteria"
                    : "There are no orders to display"}
                </p>
                {(searchQuery || selectedStatus !== "all" || selectedPaymentMethod !== "all" || (dateRange && dateRange.from)) && (
                  <Button onClick={resetFilters}>Reset Filters</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Order #
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Customer
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Phone
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Date
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Items
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Total
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Status
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 align-middle">
                          <div className="font-medium font-mono">#{order.orderNumber}</div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="font-medium">{order.customerName}</div>
                          {order.customerEmail && (
                            <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="text-sm">
                            {order.createdAt ? formatInIST(new Date(order.createdAt), "MMM dd, yyyy") : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.createdAt ? formatInIST(new Date(order.createdAt), "HH:mm") : ''}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="text-sm">{order.items.length} items</div>
                          <div className="text-xs text-muted-foreground">
                            {order.items.slice(0, 2).map(item => item.productName).join(', ')}
                            {order.items.length > 2 && '...'}
                          </div>
                        </td>
                        <td className="p-4 align-middle font-medium">
                          ₹{parseFloat(order.totalAmount).toFixed(2)}
                        </td>
                        <td className="p-4 align-middle">
                          <Badge className={getStatusColor(order.status)}>
                            {formatStatus(order.status)}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="capitalize">{formatPaymentMethod(order.paymentMethod)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}