import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Package, QrCode, ShoppingCart, Truck, ArrowUpDown, ArrowUp, ArrowDown, FileText, FileSpreadsheet, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRScannerDialog } from "@/components/qr-scanner-dialog";
import { StockMovementDialog } from "@/components/stock-movement-dialog";
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
import type { StockMovement, Product } from "@shared/schema";
// Removed date-fns format and parseISO imports as dates are now shown as raw strings

type SortField = "productName" | "sku" | "category" | "available" | "sold" | "returned" | "purchaseReturn" | "purchased" | "initialStock";
type SortOrder = "asc" | "desc";
export default function StockHistory() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<SortField>("productName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: movements = [], isLoading } = useQuery<StockMovement[]>({
    queryKey: ["/api/stock-movements"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders"],
  });

  const { data: returns = [] } = useQuery<any[]>({
    queryKey: ["/api/returns"],
  });

  // Calculate per-product stock statistics with date range filter support
  const stockStats = useMemo(() => {
    const statsMap = new Map<string, any>();
    
    // Get date boundaries
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;
    
    if (startDate) {
      startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
    }
    
    if (endDate) {
      endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
    }
  
    // Initialize with zeros
    products.forEach(p => {
      statsMap.set(p.id, {
        productId: p.id,
        available: p.stockQuantity,
        sold: 0,
        returned: 0,
        purchaseReturn: 0,
        purchased: 0,
        initialStock: 0,
      });
    });

    // Single pass through movements to calculate everything
    movements.forEach(m => {
      const currentStats = statsMap.get(m.productId);
      if (!currentStats) return;

      const movementDate = m.createdAt ? (typeof m.createdAt === 'string' ? new Date(m.createdAt) : m.createdAt) : null;
      if (!movementDate) return;

      const reasonLower = m.reason.toLowerCase();
      
      // Movements BEFORE the range contribute to initialStock
      if (startDateTime && movementDate < startDateTime) {
        switch (m.type) {
          case "in":
            currentStats.initialStock += m.quantity;
            break;
          case "out":
            currentStats.initialStock -= m.quantity;
            break;
          case "adjustment":
            // Adjustment acts as a reset
            currentStats.initialStock = m.quantity;
            break;
        }
      } 
      // Movements WITHIN the range (or all movements if no filter) contribute to period activity
      else if ((!startDateTime || movementDate >= startDateTime) && (!endDateTime || movementDate <= endDateTime)) {
        switch (m.type) {
          case "in":
            if (reasonLower.includes("initial stock")) {
              currentStats.initialStock += m.quantity;
            } else if (reasonLower.includes("purchase")) {
              currentStats.purchased += m.quantity;
            } else if (reasonLower.includes("return")) {
              currentStats.returned += m.quantity;
            } else {
              currentStats.purchased += m.quantity;
            }
            break;
          case "out":
            if (reasonLower.includes("sale")) {
              currentStats.sold += m.quantity;
            } else if (reasonLower.includes("purchase return") || reasonLower.includes("supplier return")) {
              currentStats.purchaseReturn += m.quantity;
            } else {
              currentStats.sold += m.quantity;
            }
            break;
          case "adjustment":
            // If adjustment happens in the period, we can treat it as overriding the current calculated stock
            // This is complex for a running total, so we'll just log it or handle it as a manual adjustment
            // to the 'available' calculation at the end. For now, we'll ignore it within the period activity
            // columns to keep them pure (sold, purchased, etc.) but it affects the final 'available'.
            break;
        }
      }
    });

    // Final pass to ensure all products have correct available stock from history
    statsMap.forEach(stats => {
      // Ensure initial stock is not negative
      if (stats.initialStock < 0) stats.initialStock = 0;
      
      // ALWAYS calculate available from history to ensure consistency with shown columns
      // Available (Ending Stock) = Initial (at period start) + Purchased + Returned - Sold - Purchase Return
      stats.available = stats.initialStock + stats.purchased + stats.returned - stats.sold - stats.purchaseReturn;
    });
  
    return Array.from(statsMap.values());
  }, [products, movements, startDate, endDate]);
  

  // Prepare product data for the table using stock stats
  const productStockData = useMemo(() => {
    return products.map(product => {
      const stats = stockStats.find(s => s.productId === product.id);
      return {
        ...product,
        available: stats?.available || 0,
        sold: stats?.sold || 0,
        returned: stats?.returned || 0,
        purchaseReturn: stats?.purchaseReturn || 0,
        purchased: stats?.purchased || 0,
        initialStock: stats?.initialStock || 0,
      };
    });
  }, [products, stockStats]);

  // Prepare purchased stock data for separate table
  const purchasedStockData = useMemo(() => {
    return productStockData.filter(p => p.purchased > 0);
  }, [productStockData]);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = productStockData;

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "productName":
          aValue = a.productName.toLowerCase();
          bValue = b.productName.toLowerCase();
          break;
        case "sku":
          aValue = a.sku.toLowerCase();
          bValue = b.sku.toLowerCase();
          break;
        case "category":
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case "available":
          aValue = a.available;
          bValue = b.available;
          break;
        case "sold":
          aValue = a.sold;
          bValue = b.sold;
          break;
        case "returned":
          aValue = a.returned;
          bValue = b.returned;
          break;
        case "purchaseReturn":
          aValue = a.purchaseReturn;
          bValue = b.purchaseReturn;
          break;
        case "purchased":
          aValue = a.purchased;
          bValue = b.purchased;
          break;
        default:
          aValue = a.productName.toLowerCase();
          bValue = b.productName.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }, [productStockData, categoryFilter, sortField, sortOrder]);

  // Calculate statistics from the Product Stock Overview table data (respects both date and category)
  const tableStatistics = useMemo(() => {
    // We use filteredAndSortedProducts so it respects category filter
    const visibleProducts = filteredAndSortedProducts;
    
    const totalAvailable = visibleProducts.reduce((sum, product) => sum + product.available, 0);
    const totalSold = visibleProducts.reduce((sum, product) => sum + product.sold, 0);
    const totalReturned = visibleProducts.reduce((sum, product) => sum + product.returned, 0);
    const totalPurchased = visibleProducts.reduce((sum, product) => sum + product.purchased, 0);
    
    return {
      available: totalAvailable,
      sold: totalSold,
      returned: totalReturned,
      purchased: totalPurchased,
      hasDateRange: !!(startDate || endDate)
    };
  }, [filteredAndSortedProducts, startDate, endDate]);

  // Get unique categories
  const categories = useMemo(() => {
    return ["all", ...new Set(products.map(p => p.category))];
  }, [products]);

  // Group orders with their returns
  const groupedTransactions = useMemo(() => {
    const transactions: any[] = [];
    
    const startDateTime = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const endDateTime = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

    // Add all orders
    orders.forEach(order => {
      const orderDate = new Date(order.date).getTime();
      if (startDateTime && orderDate < startDateTime) return;
      if (endDateTime && orderDate > endDateTime) return;

      const orderReturns = returns.filter(ret => ret.orderId === order.id);
      transactions.push({
        type: 'order',
        data: order,
        returns: orderReturns,
        date: order.date,
      });
    });

    // Add standalone returns (if any without order)
    returns.forEach(ret => {
      const returnDate = new Date(ret.createdAt).getTime();
      if (startDateTime && returnDate < startDateTime) return;
      if (endDateTime && returnDate > endDateTime) return;

      if (!ret.orderId) {
        transactions.push({
          type: 'return',
          data: ret,
          returns: [],
          date: ret.createdAt,
        });
      }
    });

    return transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [orders, returns, startDate, endDate]);


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "in":
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case "out":
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      case "adjustment":
        return <RefreshCw className="h-5 w-5 text-blue-600" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "in":
        return "default" as const;
      case "out":
        return "destructive" as const;
      case "adjustment":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const handleScan = (scannedData: string) => {
    // Assuming the scanned data is a product SKU or ID
    // You might need to fetch product details based on this scanned data
    console.log("Scanned data:", scannedData);
    // For now, let's assume we can directly use it to open the stock movement dialog
    // In a real scenario, you'd fetch product details here
    // setSelectedProduct({ id: scannedData, productName: `Product ${scannedData}`, sku: scannedData }); // Mock product data
    // For now, skip setting a mock product as it's not used in the dialog
    setIsStockDialogOpen(true);
    setIsScannerOpen(false);
  };

  // Function to sanitize values for CSV export
  const sanitizeForCsv = (value: string | number) => {
    if (value === undefined || value === null) return '';
    const strValue = String(value);
    // Escape double quotes by doubling them
    let sanitized = strValue.replace(/"/g, '""');
    // Wrap in quotes if it contains commas, quotes, or newlines
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
      sanitized = `"${sanitized}"`;
    }
    return sanitized;
  };

  // Export functions
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
  
  const exportStockHistory = (format: 'csv' | 'excel') => {
    console.log('Export function called with format:', format);
    
    // Headers matching the Product Stock Overview table + Created At and Updated At
    const headers = [
      'Product Name',
      'SKU',
      'Category',
      'Available Stock',
      'Initial Stock',
      'Purchased',
      'Sold',
      'Returned',
      'Purchase Return',
      'Created At'
    ];
    
    // Create rows from the filtered and sorted product data (same as displayed in UI)
    const rows = filteredAndSortedProducts.map(product => {
      const createdAtStr = product.createdAt ? new Date(product.createdAt).toISOString().replace('T', ' ').replace('Z', '') : 'N/A';
      return [
        sanitizeForCsv(product.productName),
        sanitizeForCsv(product.sku),
        sanitizeForCsv(product.category),
        sanitizeForCsv(product.available),
        sanitizeForCsv(product.initialStock),
        sanitizeForCsv(product.purchased),
        sanitizeForCsv(product.sold),
        sanitizeForCsv(product.returned),
        sanitizeForCsv(product.purchaseReturn),
        sanitizeForCsv(createdAtStr)
      ];
    });
    
    const data = [headers, ...rows];
    const filename = `stock-history-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    
    console.log('Exporting data:', data);
    console.log('Filename:', filename);
    
    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToExcel(data, filename);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Stock Movement History
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track all inventory movements and changes
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => exportStockHistory('csv')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Export (CSV)
              </Button>
              <Button
                variant="outline"
                onClick={() => exportStockHistory('excel')}
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export (Excel)
              </Button>
              <Button
                onClick={() => setIsScannerOpen(true)}
                data-testid="button-scan-for-stock"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scan to Update Stock
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Available Stock
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-available">
                  {tableStatistics.available.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total units in inventory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sold
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="stat-sold">
                  {tableStatistics.sold.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Units removed from inventory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Returned
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="stat-returned">
                  {tableStatistics.returned.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Units returned to inventory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Purchased
                </CardTitle>
                <Truck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="stat-purchased">
                  {tableStatistics.purchased.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Units added to inventory via purchase
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Product Stock Table */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Product Stock Overview</CardTitle>
                  {(startDate || endDate) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Showing movements from {startDate ? new Date(startDate).toLocaleDateString() : 'start'} to {endDate ? new Date(endDate).toLocaleDateString() : 'now'} (Initial Stock = available stock at period start)
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Date Range Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Date Range
                        {(startDate || endDate) && (
                          <div className="flex gap-1">
                            {startDate && (
                              <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                                From: {new Date(startDate).toLocaleDateString()}
                              </span>
                            )}
                            {endDate && (
                              <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                                To: {new Date(endDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-auto p-4" align="end">
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
                                onSelect={(date) => {
                                  if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    setStartDate(`${year}-${month}-${day}`);
                                  } else {
                                    setStartDate("");
                                  }
                                }}
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
                                onSelect={(date) => {
                                  if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    setEndDate(`${year}-${month}-${day}`);
                                  } else {
                                    setEndDate("");
                                  }
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        {(startDate || endDate) && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setStartDate("");
                              setEndDate("");
                            }}
                            className="w-full"
                          >
                            Clear Dates
                          </Button>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Category Filter */}
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category === "all" ? "All Categories" : category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("productName")}
                          className="hover:bg-transparent p-0 h-auto font-medium"
                        >
                          Product Name
                          <SortIcon field="productName" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("sku")}
                          className="hover:bg-transparent p-0 h-auto font-medium"
                        >
                          SKU
                          <SortIcon field="sku" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("category")}
                          className="hover:bg-transparent p-0 h-auto font-medium"
                        >
                          Category
                          <SortIcon field="category" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("available")}
                          className="hover:bg-transparent p-0 h-auto font-medium ml-auto flex"
                        >
                          Available Stock
                          <SortIcon field="available" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("initialStock")}
                          className="hover:bg-transparent p-0 h-auto font-medium ml-auto flex"
                        >
                          Initial Stock
                          <SortIcon field="initialStock" />
                        </Button>
                        {startDate || endDate ? (
                          <p className="text-xs text-muted-foreground mt-1">At Period Start</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">All Time</p>
                        )}
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("purchased")}
                          className="hover:bg-transparent p-0 h-auto font-medium ml-auto flex"
                        >
                          Purchased
                          <SortIcon field="purchased" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("sold")}
                          className="hover:bg-transparent p-0 h-auto font-medium ml-auto flex"
                        >
                          Sold
                          <SortIcon field="sold" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("returned")}
                          className="hover:bg-transparent p-0 h-auto font-medium ml-auto flex"
                        >
                          Returned
                          <SortIcon field="returned" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("purchaseReturn")}
                          className="hover:bg-transparent p-0 h-auto font-medium ml-auto flex"
                        >
                          Purchase Return
                          <SortIcon field="purchaseReturn" />
                        </Button>
                      </TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No products found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedProducts.map((product) => (
                        <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">{product.productName}</TableCell>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-gray-800 dark:text-gray-200 font-bold">{product.available}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-purple-600 font-semibold">{product.initialStock}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-green-600 font-semibold">{product.purchased}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-red-600 font-semibold">{product.sold}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-blue-600 font-semibold">{product.returned}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-orange-600 font-semibold">{product.purchaseReturn}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Stock Movement History */}
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Order & Return History</h2>
            <p className="text-sm text-muted-foreground" data-testid="text-movement-count">
              {groupedTransactions.length} {groupedTransactions.length === 1 ? "transaction" : "transactions"}
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groupedTransactions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">
                  No transactions yet
                </h3>
                <p className="text-sm text-muted-foreground">
                  Orders and returns will appear here as you manage your inventory
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {groupedTransactions.map((transaction, idx) => {
                const isOrder = transaction.type === 'order';
                const order = isOrder ? transaction.data : null;
                const returnData = !isOrder ? transaction.data : null;

                return (
                  <Card key={`${transaction.type}-${isOrder ? order?.id : returnData?.id}-${idx}`} className="hover-elevate">
                    <CardContent className="p-6">
                      {isOrder && order ? (
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="rounded-lg bg-muted p-3 flex items-center justify-center flex-shrink-0">
                              <ShoppingCart className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-lg">
                                    Order {order.orderNumber}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    Customer: {order.customerName}
                                  </p>
                                </div>
                                <Badge variant="default">
                                  Order
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Total Items</p>
                                  <p className="font-semibold">
                                    {order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0} units
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Status</p>
                                  <p className="font-semibold capitalize">{order.status}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Date</p>
                                  <p className="font-semibold">
                                    {order.date
                                        ? (typeof order.date === 'string'
                                            ? order.date
                                            : order.date.toISOString()
                                          )
                                            .replace('T', ' ')
                                            .replace('Z', '')
                                        : 'N/A'}
                                  </p>
                                </div>
                              </div>
                              {order.items && order.items.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm text-muted-foreground mb-2">Products:</p>
                                  <div className="space-y-1">
                                    {order.items.map((item: any, itemIdx: number) => (
                                      <p key={itemIdx} className="text-sm">
                                        • {item.productName} - {item.quantity} units (SKU: {item.sku})
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {transaction.returns.length > 0 && (
                            <div className="ml-16 space-y-3 pt-3 border-t">
                              <p className="text-sm font-medium text-muted-foreground">Associated Returns:</p>
                              {transaction.returns.map((ret: any, retIdx: number) => (
                                <div key={retIdx} className="flex items-start gap-4 bg-muted/50 p-4 rounded-lg">
                                  <div className="rounded-lg bg-background p-2 flex items-center justify-center flex-shrink-0">
                                    <RefreshCw className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold">
                                          Return {ret.returnNumber}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                          Reason: {ret.reason}
                                        </p>
                                      </div>
                                      <Badge variant="secondary">
                                        Return
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Total Items</p>
                                        <p className="font-semibold">
                                          {ret.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0} units
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Date</p>
                                        <p className="font-semibold">
                                          {ret.date
                                              ? (typeof ret.date === 'string'
                                                  ? ret.date
                                                  : ret.date.toISOString()
                                                )
                                                  .replace('T', ' ')
                                                  .replace('Z', '')
                                              : 'N/A'}
                                        </p>
                                      </div>
                                    </div>
                                    {ret.items && ret.items.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-sm text-muted-foreground mb-1">Products:</p>
                                        <div className="space-y-1">
                                          {ret.items.map((item: any, itemIdx: number) => (
                                            <p key={itemIdx} className="text-sm">
                                              • {item.productName} - {item.quantity} units (SKU: {item.sku})
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : returnData ? (
                        <div className="flex items-start gap-4">
                          <div className="rounded-lg bg-muted p-3 flex items-center justify-center flex-shrink-0">
                            <RefreshCw className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg">
                                  Return {returnData.returnNumber}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Reason: {returnData.reason}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                Standalone Return
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Total Items</p>
                                <p className="font-semibold">
                                  {returnData.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0} units
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Date</p>
                                <p className="font-semibold">
                                  {returnData.date
                                      ? (typeof returnData.date === 'string'
                                          ? returnData.date
                                          : returnData.date.toISOString()
                                        )
                                          .replace('T', ' ')
                                          .replace('Z', '')
                                      : 'N/A'}
                                </p>
                              </div>
                            </div>
                            {returnData.items && returnData.items.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm text-muted-foreground mb-2">Products:</p>
                                <div className="space-y-1">
                                  {returnData.items.map((item: any, itemIdx: number) => (
                                    <p key={itemIdx} className="text-sm">
                                      • {item.productName} - {item.quantity} units (SKU: {item.sku})
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <QRScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onProductScanned={(product) => {
          setSelectedProduct(product);
          setIsStockDialogOpen(true);
          setIsScannerOpen(false);
        }}
      />
      {selectedProduct && (
        <StockMovementDialog
          open={isStockDialogOpen}
          onOpenChange={(open) => {
            setIsStockDialogOpen(open);
            if (!open) setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
      )}
    </div>
  );
}