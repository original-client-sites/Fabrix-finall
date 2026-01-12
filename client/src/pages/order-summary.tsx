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
import { CalendarIcon, Download, Filter, X, FileText, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { formatInIST } from "../lib/utils";
import type { OrderWithItems, PaymentDetail, ReturnWithItems, DiscountCode } from "@shared/schema";

// Import the date range type from react-day-picker
import { DateRange as DayPickerDateRange } from "react-day-picker";

export default function OrderSummary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DayPickerDateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });
  
  const { data: returns = [] } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  });
  
  const { data: discountCodes = [] } = useQuery({
    queryKey: ["/api/discount-codes"],
    queryFn: async () => {
      const response = await fetch("/api/discount-codes");
      if (!response.ok) {
        throw new Error("Failed to fetch discount codes");
      }
      return response.json();
    },
  });
  
  // Function to get returns for an order
  const getReturnsForOrder = (orderId: string) => {
    return returns.filter((ret) => ret.orderId === orderId);
  };
  
  // Function to get discount codes for a customer
  const getCustomerDiscountCodes = (customerEmail: string) => {
    return discountCodes.filter((code: DiscountCode) => code.customerEmail === customerEmail && !code.isUsed);
  };
  
  // Function to calculate remaining store credit for a customer
  const getRemainingStoreCredit = (customerEmail: string) => {
    const codes = getCustomerDiscountCodes(customerEmail);
    return codes.reduce((total: number, code: DiscountCode) => total + parseFloat(code.amount), 0);
  };
  
  // Function to get used store credit for an order
  const getUsedStoreCreditForOrder = (order: OrderWithItems) => {
    // Check if this order was used to create a return that had credit amount
    const orderReturns = getReturnsForOrder(order.id);
    const totalCreditAmount = orderReturns.reduce((total, ret) => {
      return total + (parseFloat(ret.creditAmount || '0'));
    }, 0);
    
    // Also check if the order itself used a discount code (store credit)
    let discountCodeAmount = 0;
    if (order.payments) {
      const storeCreditPayments = order.payments.filter(p => p.paymentMethod === 'store_credit');
      discountCodeAmount = storeCreditPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }
    
    return { creditFromReturns: totalCreditAmount, discountCodeAmount, totalUsed: totalCreditAmount + discountCodeAmount };
  };
  
  // Function to get returned items for an order
  const getReturnedItemsForOrder = (orderId: string) => {
    const orderReturns = getReturnsForOrder(orderId);
    return orderReturns.flatMap(ret => ret.items.map(item => ({
      ...item,
      returnReason: ret.reason,
      returnStatus: ret.status
    })));
  };
  
  // Function to get exchanged items for an order
  const getExchangedItemsForOrder = (orderId: string) => {
    const orderReturns = getReturnsForOrder(orderId);
    return orderReturns.flatMap(ret => 
      ret.items.filter(item => item.exchangeProductId || item.exchangeProductName)
        .map(item => ({
          ...item,
          returnReason: ret.reason,
          returnStatus: ret.status
        }))
    );
  };

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
      const orderDate = new Date(order.createdAt!);
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

  // Render payment breakdown for mixed payments
  const renderPaymentBreakdown = (order: OrderWithItems) => {
    if (order.paymentMethod === 'mixed' && order.payments && order.payments.length > 0) {
      return (
        <div className="text-xs space-y-1">
          <div className="font-medium">Payment Breakdown:</div>
          {order.payments.map((payment, index) => (
            <div key={index} className="flex justify-between">
              <span className="text-muted-foreground capitalize">{formatPaymentMethod(payment.paymentMethod)}:</span>
              <span>₹{parseFloat(payment.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format status display
  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Process payment methods into separate columns
  const processPaymentMethods = (order: OrderWithItems) => {
    // Initialize all payment method amounts to 0
    let cash = 0;
    let creditCard = 0;
    let debitCash = 0; // Renamed from debitCard to match requested column name
    let upi = 0;
    
    if (order.paymentMethod === 'mixed' && order.payments && order.payments.length > 0) {
      // If it's a mixed payment, sum up each payment method
      order.payments.forEach((payment: PaymentDetail) => {
        const amount = parseFloat(payment.amount) || 0;
        switch (payment.paymentMethod) {
          case 'cash':
            cash += amount;
            break;
          case 'credit_card':
            creditCard += amount;
            break;
          case 'debit_card':
            debitCash += amount; // Changed to debitCash to match requested column name
            break;
          case 'upi':
            upi += amount;
            break;
          case 'bank_transfer':
            // Bank transfer is not in the requested columns, so we'll add it to UPI for now
            // Or we could create a separate column for it
            upi += amount;
            break;
          case 'store_credit':
            // Store credit is not in the requested columns, so we'll add it to cash for now
            cash += amount;
            break;
          default:
            // Default to cash if unknown payment method
            cash += amount;
            break;
        }
      });
    } else {
      // If it's not mixed, assign the total amount to the appropriate column
      const amount = parseFloat(order.totalAmount) || 0;
      switch (order.paymentMethod) {
        case 'cash':
          cash = amount;
          break;
        case 'credit_card':
          creditCard = amount;
          break;
        case 'debit_card':
          debitCash = amount; // Changed to debitCash to match requested column name
          break;
        case 'upi':
          upi = amount;
          break;
        case 'bank_transfer':
          upi = amount; // Map to UPI as per requested columns
          break;
        case 'store_credit':
          cash = amount; // Map to cash as per requested columns
          break;
        default:
          cash = amount; // Default to cash
          break;
      }
    }
    
    return { cash, creditCard, debitCash, upi };
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

  // Function to aggregate daily payment data
  const getDailyPaymentSummary = () => {
    const dailyPayments: Record<string, Record<string, number>> = {};
    
    filteredOrders.forEach(order => {
      const date = order.createdAt ? formatInIST(new Date(order.createdAt), "yyyy-MM-dd") : 'N/A';
      const paymentMethod = order.paymentMethod || 'cash';
      const amount = parseFloat(order.totalAmount) || 0;
      
      if (!dailyPayments[date]) {
        dailyPayments[date] = {
          cash: 0,
          credit_card: 0,
          debit_card: 0,
          upi: 0,
          bank_transfer: 0,
          store_credit: 0,
          mixed: 0
        };
      }
      
      if (dailyPayments[date][paymentMethod] !== undefined) {
        dailyPayments[date][paymentMethod] += amount;
      }
    });
    
    // Convert to array and sort by date
    return Object.entries(dailyPayments)
      .map(([date, payments]) => ({
        date,
        cash: payments.cash,
        credit_card: payments.credit_card,
        debit_card: payments.debit_card,
        upi: payments.upi,
        bank_transfer: payments.bank_transfer,
        store_credit: payments.store_credit,
        mixed: payments.mixed
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };
  
  const dailyPaymentSummary = getDailyPaymentSummary();

  // Export functions
  const formatDateForExport = (dateString: string) => {
    if (!dateString) return 'N/A';
    // Ensure the date is formatted as dd-mm-yyyy to prevent Excel from interpreting as scientific notation
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `"${day}-${month}-${year}"`; // Wrap in quotes to ensure Excel treats as text
  };
  
  const exportToCSV = (data: any[][], filename: string) => {
    const csvContent = data.map(row => row.map(field => `${field}`.replace(/\"/g, '"').replace(/\,/g, ',')).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportToExcel = (data: any[][], filename: string) => {
    // For simplicity, we'll use the same approach as CSV but with .xlsx extension
    // In a real application, you'd use a library like xlsx to create proper Excel files
    const csvContent = data.map(row => row.map(field => `${field}`.replace(/\"/g, '"').replace(/\,/g, ',')).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportOrderSummary = (format: 'csv' | 'excel') => {
    const headers = ['Order #', 'Customer Name', 'Phone Number', 'Date', 'Items', 'Cash', 'Credit Card', 'Debit Cash', 'UPI', 'Discount Amount', 'Remaining Store Credit', 'Used Store Credit', 'Returned Items', 'Items Taken in Exchange', 'Total'];
    const rows = filteredOrders.map(order => {
      const paymentData = processPaymentMethods(order);
      const remainingStoreCredit = getRemainingStoreCredit(order.customerEmail || '');
      const usedStoreCredit = getUsedStoreCreditForOrder(order);
      const returnedItems = getReturnedItemsForOrder(order.id);
      const exchangedItems = getExchangedItemsForOrder(order.id);
      
      return [
        order.orderNumber,
        order.customerName,
        order.customerPhone ? `"${order.customerPhone}"` : '',
        order.createdAt ? formatDateForExport(order.createdAt.toString()) : '"N/A"',
        order.items.map(item => item.productName).join(', '),
        paymentData.cash.toFixed(2),
        paymentData.creditCard.toFixed(2),
        paymentData.debitCash.toFixed(2),
        paymentData.upi.toFixed(2),
        parseFloat(order.discountAmount || '0').toFixed(2),
        remainingStoreCredit.toFixed(2),
        usedStoreCredit.totalUsed.toFixed(2),
        returnedItems.length > 0 
          ? returnedItems.map(item => `${item.quantity}x ${item.productName}`).join(', ')
          : 'None',
        exchangedItems.length > 0
          ? exchangedItems.map(item => `${item.quantity}x ${item.exchangeProductName || item.exchangeProductId}`).join(', ')
          : 'None',
        parseFloat(order.totalAmount).toFixed(2)
      ];
    });
    
    const data = [headers, ...rows];
    const filename = `order-summary-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    
    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToExcel(data, filename);
    }
  };
  
  const exportPaymentSummary = (format: 'csv' | 'excel') => {
    const headers = ['Date', 'Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Store Credit', 'Mixed', 'Total'];
    const rows = dailyPaymentSummary.map(day => {
      const total = day.cash + day.credit_card + day.debit_card + day.upi + 
                  day.bank_transfer + day.store_credit + day.mixed;
      return [
        formatDateForExport(day.date),
        day.cash.toFixed(2),
        day.credit_card.toFixed(2),
        day.debit_card.toFixed(2),
        day.upi.toFixed(2),
        day.bank_transfer.toFixed(2),
        day.store_credit.toFixed(2),
        day.mixed.toFixed(2),
        total.toFixed(2)
      ];
    });
    
    const data = [headers, ...rows];
    const filename = `payment-summary-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    
    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToExcel(data, filename);
    }
  };
  
  const exportBothTables = (format: 'csv' | 'excel') => {
    // Now that we have only one table, use the same export as single table
    exportOrderSummary(format);
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => exportOrderSummary('csv')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Export (CSV)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportOrderSummary('excel')}
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export (Excel)
                </Button>
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
                        Customer Name
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Phone Number
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Date
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Items
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Cash
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Credit Card
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Debit Cash
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        UPI
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Discount Amount
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Remaining Store Credit
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Used Store Credit
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Returned Items
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Items Taken in Exchange
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((order) => {
                      const paymentData = processPaymentMethods(order);
                      const remainingStoreCredit = getRemainingStoreCredit(order.customerEmail || '');
                      const usedStoreCredit = getUsedStoreCreditForOrder(order);
                      const returnedItems = getReturnedItemsForOrder(order.id);
                      const exchangedItems = getExchangedItemsForOrder(order.id);
                      
                      return (
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
                            {order.customerPhone && (
                              <div className="font-medium">{order.customerPhone}</div>
                            )}
                          </td>
                          <td className="p-4 align-middle">
                            <div className="text-sm">
                              {order.createdAt ? formatInIST(new Date(order.createdAt), "MMM dd, yyyy") : 'N/A'}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="text-sm">
                              {order.items.map(item => item.productName).join(', ')}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            ₹{paymentData.cash.toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            ₹{paymentData.creditCard.toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            ₹{paymentData.debitCash.toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            ₹{paymentData.upi.toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            ₹{(parseFloat(order.discountAmount || '0')).toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            ₹{remainingStoreCredit.toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            ₹{usedStoreCredit.totalUsed.toFixed(2)}
                          </td>
                          <td className="p-4 align-middle">
                            <div className="text-sm">
                              {returnedItems.length > 0 
                                ? returnedItems.map(item => `${item.quantity}x ${item.productName}`).join(', ')
                                : 'None'}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="text-sm">
                              {exchangedItems.length > 0
                                ? exchangedItems.map(item => `${item.quantity}x ${item.exchangeProductName || item.exchangeProductId}`).join(', ')
                                : 'None'}
                            </div>
                          </td>
                          <td className="p-4 align-middle font-medium">
                            ₹{parseFloat(order.totalAmount).toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
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