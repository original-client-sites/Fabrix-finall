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
// Removed date-fns format import as dates are now shown as raw strings
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import type { OrderWithItems, PaymentDetail, ReturnWithItems, DiscountCode, Product } from "@shared/schema";

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
  
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
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
  
  // Function to get all discount codes for a customer
  const getCustomerDiscountCodes = (customerName: string) => {
    return discountCodes.filter((code: DiscountCode) => code.customerName === customerName);
  };
  
  // Function to calculate remaining store credit for a customer - fetched directly from discount codes table
  const getRemainingStoreCredit = (customerName: string) => {
    const codes = getCustomerDiscountCodes(customerName);
    return codes.reduce((total: number, code: DiscountCode) => {
      // Sum up all remaining amounts in the discount codes
      return total + parseFloat(code.amount);
    }, 0);
  };
  
  // Function to get total store credit issued to a customer
  const getTotalStoreCreditIssued = (customerName: string) => {
    // This would need to track original issued amounts, but since that's not available,
    // we'll use a different approach based on historical records
    const codes = getCustomerDiscountCodes(customerName);
    
    // For now, calculate based on store credit payments in orders
    let totalIssued = 0;
    orders.forEach(order => {
      if (order.customerName === customerName) {
        // Check if this order created returns with store credit
        const orderReturns = getReturnsForOrder(order.id);
        orderReturns.forEach(ret => {
          if (ret.creditAmount) {
            totalIssued += parseFloat(ret.creditAmount);
          }
        });
      }
    });
    
    return totalIssued;
  };
  
  // Function to get used store credit for a customer - fetched directly from discount codes table
  const getUsedStoreCreditForCustomer = (customerName: string) => {
    // Total issued minus remaining equals used
    const totalIssued = getTotalStoreCreditIssued(customerName);
    const remaining = getRemainingStoreCredit(customerName);
    return Math.max(0, totalIssued - remaining); // Prevent negative values
  };
  
  // Function to get used store credit for an order
  const getUsedStoreCreditForOrder = (order: OrderWithItems) => {
    // Check if the order itself used a discount code (store credit)
    let discountCodeAmount = 0;
    if (order.payments) {
      const storeCreditPayments = order.payments.filter(p => p.paymentMethod === 'store_credit');
      discountCodeAmount = storeCreditPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }
    
    // For the customer's total used store credit, we'll calculate from the discount codes table
    const totalUsedByCustomer = getUsedStoreCreditForCustomer(order.customerName || '');
    
    return { creditFromReturns: 0, discountCodeAmount, totalUsed: totalUsedByCustomer };
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
      const orderDate = new Date(order.date!);
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
  const processPaymentMethods = (order: OrderWithItems, itemSubtotal: number) => {
    // Initialize all payment method amounts to 0
    let cash = 0;
    let creditCard = 0;
    let debitCash = 0; // Renamed from debitCard to match requested column name
    let upi = 0;
    
    // Find the current item in the order
    const items = order.items;
    
    // Calculate the total order amount based on item subtotals (actual bill amount)
    const orderTotalFromItems = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    
    if (order.paymentMethod === 'mixed' && order.payments && order.payments.length > 0) {
      // For mixed payments, we need to use the original payment amounts
      // entered in the dialog box without using calculated float values
      
      // First, let's group the payments by method
      const paymentByMethod: Record<string, number> = {};
      for (const payment of order.payments) {
        const method = payment.paymentMethod;
        const amount = Math.round(parseFloat(payment.amount) || 0); // Original integer value
        paymentByMethod[method] = (paymentByMethod[method] || 0) + amount;
      }
      
      // Calculate the proportion of the current item relative to the total
      const itemProportion = orderTotalFromItems > 0 ? itemSubtotal / orderTotalFromItems : 0;
      
      // For each payment method, distribute the total amount based on item proportion
      for (const [method, totalAmount] of Object.entries(paymentByMethod)) {
        // Calculate the item's share of this payment method based on its proportion
        const itemShare = Math.round(totalAmount * itemProportion);
        
        // Assign the calculated amount based on payment method
        switch (method) {
          case 'cash':
            cash = itemShare;
            break;
          case 'credit_card':
            creditCard = itemShare;
            break;
          case 'debit_card':
            debitCash = itemShare; // Changed to debitCash to match requested column name
            break;
          case 'upi':
            upi = itemShare;
            break;
          case 'bank_transfer':
            // Bank transfer is not in the requested columns, so we'll add it to UPI for now
            upi += itemShare;
            break;
          case 'store_credit':
            // Store credit is not in the requested columns, so we'll add it to cash for now
            cash += itemShare;
            break;
          default:
            // Default to cash if unknown payment method
            cash += itemShare;
            break;
        }
      }
    } else {
      // For non-mixed payments, distribute the single payment method amount proportionally
      const orderTotal = parseFloat(String(order.totalAmount)) || 0;
      
      // Calculate the proportion of the current item relative to the total
      const itemProportion = orderTotal > 0 ? itemSubtotal / orderTotal : 0;
      
      // Get the payment amount for this method
      let paymentAmount = 0;
      if (order.payments && order.payments.length > 0) {
        // For non-mixed orders that have payment details
        const payment = order.payments.find(p => p.paymentMethod === order.paymentMethod);
        paymentAmount = payment ? Math.round(parseFloat(payment.amount) || 0) : 0;
      } else {
        // Fallback to totalAmount for backward compatibility
        paymentAmount = Math.round(orderTotal);
      }
      
      // Calculate item's share based on proportion
      const itemShare = Math.round(paymentAmount * itemProportion);
      
      // Assign based on payment method
      switch (order.paymentMethod) {
        case 'cash':
          cash = itemShare;
          break;
        case 'credit_card':
          creditCard = itemShare;
          break;
        case 'debit_card':
          debitCash = itemShare; // Changed to debitCash to match requested column name
          break;
        case 'upi':
          upi = itemShare;
          break;
        case 'bank_transfer':
          upi = itemShare; // Map to UPI as per requested columns
          break;
        case 'store_credit':
          cash = itemShare; // Map to cash as per requested columns
          break;
        default:
          cash = itemShare; // Default to cash
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

  // Function to get product category by product name
  const getProductCategoryByName = (productName: string) => {
    const product = products.find(p => p.productName === productName);
    return product ? product.category : 'Uncategorized';
  };

  // Function to get all unique categories from both orders and products
  const getAllCategories = () => {
    const categories = new Set<string>();
    
    // Add categories from all orders
    orders.forEach(order => {
      order.items.forEach(item => {
        const category = getProductCategoryByName(item.productName);
        categories.add(category);
      });
    });
    
    // Also add all possible categories from the products table
    products.forEach(product => {
      categories.add(product.category);
    });
    
    return Array.from(categories).sort();
  };

  // Function to get items for a specific category in an order
  const getItemsForCategory = (order: OrderWithItems, categoryName: string) => {
    const items = order.items.filter(item => {
      const category = getProductCategoryByName(item.productName);
      return category === categoryName;
    });
    
    const result = items.map(item => `${item.quantity} ${item.productName}`).join(', ');
    return result || ''; // Return empty string instead of undefined/empty
  };

  // Function to sanitize values for CSV export
  const sanitizeForCsv = (value: string) => {
    if (!value) return '';
    // Escape double quotes by doubling them
    let sanitized = value.replace(/"/g, '""');
    // Wrap in quotes if it contains commas, quotes, or newlines
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
      sanitized = `"${sanitized}"`;
    }
    return sanitized;
  };

  // Function to aggregate daily payment data
  const getDailyPaymentSummary = () => {
    const dailyPayments: Record<string, Record<string, number>> = {};
        
    filteredOrders.forEach(order => {
      const date = order.date ? String(order.date) : 'N/A';
  
      const paymentMethod = order.paymentMethod || 'cash';
      const amount = parseFloat(String(order.totalAmount)) || 0;
          
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
    return dateString; // Return raw date string without formatting
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
    // Transform orders into item-based rows
    const transformedRows: any[][] = [];
    
    // Headers for the new format
    const headers = [
      'Order #', 
      'Customer Name', 
      'Phone Number', 
      'Date', 
      'Item Type', 
      'Quantity',
      'Cash', 
      'Credit Card', 
      'Debit Cash', 
      'UPI', 
      'Payment Total', // New column
      'Discount Amount', 
      'Remaining Store Credit', 
      'Used Store Credit', 
      'Returned Items', 
      'Items Taken in Exchange', 
      'Total'
    ];
    
    filteredOrders.forEach(order => {
      const remainingStoreCredit = getRemainingStoreCredit(order.customerName || '');
      const usedStoreCredit = { discountCodeAmount: 0, totalUsed: getUsedStoreCreditForCustomer(order.customerName || '') };
      const returnedItems = getReturnedItemsForOrder(order.id);
      const exchangedItems = getExchangedItemsForOrder(order.id);
      
      // Calculate the highest priced item for discount application
      const itemsWithPrices = order.items.map(i => ({
        item: i,
        price: parseFloat(i.subtotal) || 0
      })).sort((a, b) => b.price - a.price);
      
      // Create a row for each item in the order
      order.items.forEach((item, index) => {
        const itemCategory = getProductCategoryByName(item.productName);
        const itemSubtotal = parseFloat(item.subtotal) || 0;
        const paymentData = processPaymentMethods(order, itemSubtotal);
        
        // Calculate payment total (sum of all payment methods PLUS discount amount)
        const basePaymentTotal = paymentData.cash + paymentData.creditCard + paymentData.debitCash + paymentData.upi;
        
        // Apply discount only to the item with the highest subtotal
        let discountForThisItem = 0;
        if (itemsWithPrices.length > 0 && itemsWithPrices[0].item.id === item.id) { // Apply discount to highest priced item
          discountForThisItem = parseFloat(String(order.discountAmount || '0'));
        }
        
        // Payment Total includes the discount amount that was applied
        const paymentTotal = basePaymentTotal + discountForThisItem;
            
        // Calculate final total as payment total minus discount (which gives us back the base amount)
        const finalTotal = paymentTotal - discountForThisItem;
        
        const row = [
          order.orderNumber,
          order.customerName,
          order.customerPhone ? sanitizeForCsv(order.customerPhone) : '',
          order.date
      ? sanitizeForCsv(new Date(order.date instanceof Date ? order.date : new Date(order.date)).toISOString().split('T')[0])
      : sanitizeForCsv('N/A'),
          sanitizeForCsv(itemCategory), // Item Type (using category)
          item.quantity, // Quantity
          paymentData.cash.toFixed(2),
          paymentData.creditCard.toFixed(2),
          paymentData.debitCash.toFixed(2),
          paymentData.upi.toFixed(2),
          paymentTotal.toFixed(2), // New column
          discountForThisItem.toFixed(2),
          remainingStoreCredit.toFixed(2),
          usedStoreCredit.totalUsed.toFixed(2),
          sanitizeForCsv(returnedItems.length > 0 
            ? returnedItems.map(item => `${item.quantity}x ${item.productName}`).join(', ')
            : 'None'),
          sanitizeForCsv(exchangedItems.length > 0
            ? exchangedItems.map(item => `${item.quantity}x ${item.exchangeProductName || item.exchangeProductId}`).join(', ')
            : 'None'),
          finalTotal.toFixed(2) // Updated to be payment total - discount
        ];
        transformedRows.push(row);
      });
    });
    
    const data = [headers, ...transformedRows];
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
        `"${(typeof day.date === 'string'
        ? day.date
        : new Date(day.date).toISOString()
      )
        .replace('T', ' ')
        .replace('Z', '')}"`,
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
                          {dateRange.from.toString()} -{" "}
                          {dateRange.to.toString()}
                        </>
                      ) : (
                        dateRange.from.toString()
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
                        Date: {dateRange && dateRange.from ? dateRange.from.toString() : ''}
                        {dateRange && dateRange.to && ` - ${dateRange.to.toString()}`}
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
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-max table-auto">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Order #
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Customer Name
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Phone Number
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Date
                      </th>
                      {getAllCategories().map(category => (
                        <th key={`header-${category}`} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                          {category}
                        </th>
                      ))}
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Cash
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Credit Card
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Debit Cash
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        UPI
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Payment Total
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Discount Amount
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Remaining Store Credit
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Used Store Credit
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Returned Items
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Items Taken in Exchange
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((order, orderIndex) => {
                      const remainingStoreCredit = getRemainingStoreCredit(order.customerName || '');
                      const usedStoreCredit = { discountCodeAmount: 0, totalUsed: getUsedStoreCreditForCustomer(order.customerName || '') };
                      const returnedItems = getReturnedItemsForOrder(order.id);
                      const exchangedItems = getExchangedItemsForOrder(order.id);
                      
                      return (
                        <tr key={`${order.id}-${orderIndex}`} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4 align-middle whitespace-nowrap" rowSpan={order.items.length}>
                            <div className="font-medium font-mono">#{order.orderNumber}</div>
                          </td>
                          <td className="p-4 align-middle whitespace-nowrap" rowSpan={order.items.length}>
                            <div className="font-medium">{order.customerName}</div>
                            {order.customerEmail && (
                              <div className="text-sm text-muted-foreground truncate max-w-32">{order.customerEmail}</div>
                            )}
                          </td>
                          <td className="p-4 align-middle whitespace-nowrap" rowSpan={order.items.length}>
                            {order.customerPhone ? (
                              <div className="font-medium">{order.customerPhone}</div>
                            ) : (
                              <div className="text-sm text-muted-foreground">N/A</div>
                            )}
                          </td>
                          <td className="p-4 align-middle whitespace-nowrap" rowSpan={order.items.length}>
                            <div className="text-sm">
                              {order.date
                                ? new Date(order.date instanceof Date ? order.date : new Date(order.date)).toISOString().split('T')[0]
                                : 'N/A'}
                            </div>
                          </td>
                          {order.items.map((item, itemIndex) => {
                            const itemCategory = getProductCategoryByName(item.productName);
                            const itemSubtotal = parseFloat(item.subtotal) || 0;
                            const paymentData = processPaymentMethods(order, itemSubtotal);
                            
                            // Apply discount only to the item with the highest price
                            let discountForThisItem = 0;
                            const itemsWithPrices = order.items.map(i => ({
                              item: i,
                              price: parseFloat(i.subtotal) || 0
                            })).sort((a, b) => b.price - a.price);
                            
                            // Apply discount to the highest priced item
                            if (itemsWithPrices.length > 0 && itemsWithPrices[0].item.id === item.id) {
                              discountForThisItem = parseFloat(String(order.discountAmount || '0'));
                            }
                            
                            // Calculate payment total (sum of all payment methods PLUS discount amount)
                            const basePaymentTotal = paymentData.cash + paymentData.creditCard + paymentData.debitCash + paymentData.upi;
                            const paymentTotal = basePaymentTotal + discountForThisItem;
                            const finalTotal = paymentTotal - discountForThisItem;
                            
                            // Only show category columns for the first item
                            const categoryCells = itemIndex === 0 
                              ? getAllCategories().map(category => (
                                  <td key={`category-${category}`} className="p-4 align-middle whitespace-nowrap">
                                    <div className="text-sm truncate max-w-20">
                                      {getItemsForCategory(order, category)}
                                    </div>
                                  </td>
                                ))
                              : [];
                            
                            return (
                              <>
                                {itemIndex > 0 && (
                                  <>
                                    <td className="p-4 align-middle"></td>
                                    <td className="p-4 align-middle"></td>
                                    <td className="p-4 align-middle"></td>
                                    <td className="p-4 align-middle"></td>
                                    <td className="p-4 align-middle"></td>
                                  </>
                                )}
                                <td className="p-4 align-middle max-w-xs">
                                  <div className="font-medium truncate">{item.productName}</div>
                                  <div className="text-sm text-muted-foreground truncate">SKU: {item.sku}</div>
                                  <div className="text-sm">Qty: {item.quantity}</div>
                                  {discountForThisItem > 0 && (
                                    <div className="text-xs text-green-600 mt-1">
                                      Discount applied: ₹{discountForThisItem.toFixed(2)}
                                    </div>
                                  )}
                                </td>
                                {categoryCells}
                                <td className="p-4 align-middle whitespace-nowrap">
                                  ₹{paymentData.cash.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap">
                                  ₹{paymentData.creditCard.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap">
                                  ₹{paymentData.debitCash.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap">
                                  ₹{paymentData.upi.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap">
                                  ₹{paymentTotal.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap">
                                  ₹{discountForThisItem.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap" rowSpan={order.items.length}>
                                  ₹{remainingStoreCredit.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle whitespace-nowrap" rowSpan={order.items.length}>
                                  ₹{usedStoreCredit.totalUsed.toFixed(2)}
                                </td>
                                <td className="p-4 align-middle max-w-xs" rowSpan={order.items.length}>
                                  <div className="text-sm truncate">
                                    {returnedItems.length > 0 
                                      ? returnedItems.map(item => `${item.quantity}x ${item.productName}`).join(', ')
                                      : 'None'}
                                  </div>
                                </td>
                                <td className="p-4 align-middle max-w-xs" rowSpan={order.items.length}>
                                  <div className="text-sm truncate">
                                    {exchangedItems.length > 0
                                      ? exchangedItems.map(item => `${item.quantity}x ${item.exchangeProductName || item.exchangeProductId}`).join(', ')
                                      : 'None'}
                                  </div>
                                </td>
                                <td className="p-4 align-middle font-medium whitespace-nowrap">
                                  ₹{(paymentData.cash + paymentData.creditCard + paymentData.debitCash + paymentData.upi - discountForThisItem).toFixed(2)}
                                </td>
                              </>
                            );
                          })}
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