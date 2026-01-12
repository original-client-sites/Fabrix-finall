import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Package, QrCode, ShoppingCart, Truck, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import type { StockMovement, Product } from "@shared/schema";
import { format } from "date-fns";
import { formatInIST } from "@/lib/utils";

type SortField = "productName" | "sku" | "category" | "available" | "sold" | "returned" | "purchaseReturn" | "purchased" | "initialStock";
type SortOrder = "asc" | "desc";

interface StockStats {
  productId: string;
  available: number;
  sold: number;
  returned: number;
  purchaseReturn: number;
  purchased: number;
  initialStock: number;
}

export default function StockHistory() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<SortField>("productName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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

  // Calculate overall statistics
  const statistics = useMemo(() => {
    // Calculate from stock movements (excluding initial stock)
    const totalPurchasedFromMovements = movements
      .filter(m => {
        const reasonLower = m.reason.toLowerCase();
        return m.type === "in" && reasonLower === "purchase";
      })
      .reduce((sum, m) => sum + m.quantity, 0);

    const totalReturnedFromMovements = movements
      .filter(m => m.type === "in" && (m.reason === "Return" || m.reason === "return"))
      .reduce((sum, m) => sum + m.quantity, 0);

    const totalSoldFromMovements = movements
      .filter(m => m.type === "out" && (m.reason === "Sale" || m.reason === "sale"))
      .reduce((sum, m) => sum + m.quantity, 0);

    // Calculate from orders
    const totalSoldFromOrders = orders.reduce((sum, order) => {
      if (order.items && Array.isArray(order.items)) {
        return sum + order.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0);
      }
      return sum;
    }, 0);

    // Calculate from returns
    const totalReturnedFromReturns = returns.reduce((sum, ret) => {
      if (ret.items && Array.isArray(ret.items)) {
        return sum + ret.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0);
      }
      return sum;
    }, 0);

    const totalAvailable = products.reduce((sum, p) => sum + p.stockQuantity, 0);
    const totalSold = totalSoldFromMovements + totalSoldFromOrders;
    const totalReturned = totalReturnedFromMovements + totalReturnedFromReturns;

    return {
      available: totalAvailable,
      sold: totalSold,
      returned: totalReturned,
      purchased: totalPurchasedFromMovements,
    };
  }, [movements, products, orders, returns]);

  // Calculate per-product stock statistics
  const stockStats = useMemo(() => {
    const statsMap = new Map<string, StockStats>();

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

    // Process stock movements to calculate initial stock, sold, returned, and purchased
    movements.forEach(m => {
      const currentStats = statsMap.get(m.productId);
      if (!currentStats) return;
      const reasonLower = m.reason.toLowerCase();

      switch (m.type) {
        case "in":
          if (reasonLower === "initial stock") {
            currentStats.initialStock += m.quantity;
          } else if (reasonLower === "purchase") {
            currentStats.purchased += m.quantity;
          } else if (reasonLower === "return") {
            currentStats.returned += m.quantity;
          }
          break;
        case "out":
          if (reasonLower === "sale") {
            currentStats.sold += m.quantity;
          } else if (reasonLower === "purchase return" || reasonLower === "supplier return") {
            currentStats.purchaseReturn += m.quantity;
          }
          break;
        case "adjustment":
          // For adjustment movements, these are direct quantity changes
          // Typically used for setting stock to a specific value
          break;
      }
    });

    // Process orders to count sold items
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const stats = statsMap.get(item.productId);
          if (stats) {
            stats.sold += item.quantity;
          }
        });
      }
    });

    // Process returns to count returned items
    returns.forEach(ret => {
      if (ret.items && Array.isArray(ret.items)) {
        ret.items.forEach((item: any) => {
          const stats = statsMap.get(item.productId);
          if (stats) {
            stats.returned += item.quantity;
          }
        });
      }
    });

    // Calculate available stock using the proper formula
    // available = initialStock + purchased - sold + returned - purchaseReturn
    // This ensures purchase returns are properly deducted from available stock
    Array.from(statsMap.values()).forEach(stats => {
      stats.available = stats.initialStock + stats.purchased - stats.sold + stats.returned - stats.purchaseReturn;
    });

    return Array.from(statsMap.values());
  }, [products, movements, orders, returns]);


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

  // Calculate statistics from the Product Stock Overview table data
  const tableStatistics = useMemo(() => {
    // Calculate totals from the product stock data table
    const totalAvailable = productStockData.reduce((sum, product) => sum + product.available, 0);
    const totalSold = productStockData.reduce((sum, product) => sum + product.sold, 0);
    const totalReturned = productStockData.reduce((sum, product) => sum + product.returned, 0);
    const totalPurchased = productStockData.reduce((sum, product) => sum + product.purchased, 0);
    
    return {
      available: totalAvailable,
      sold: totalSold,
      returned: totalReturned,
      purchased: totalPurchased,
    };
  }, [productStockData]);

  // Prepare purchased stock data for separate table
  const purchasedStockData = useMemo(() => {
    return productStockData.filter(p => p.purchased > 0);
  }, [productStockData]);

  // Get unique categories
  const categories = useMemo(() => {
    return ["all", ...new Set(products.map(p => p.category))];
  }, [products]);

  // Group orders with their returns
  const groupedTransactions = useMemo(() => {
    const transactions: any[] = [];

    // Add all orders
    orders.forEach(order => {
      const orderReturns = returns.filter(ret => ret.orderId === order.id);
      transactions.push({
        type: 'order',
        data: order,
        returns: orderReturns,
        date: order.createdAt,
      });
    });

    // Add standalone returns (if any without order)
    returns.forEach(ret => {
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
  }, [orders, returns]);

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
                <CardTitle>Product Stock Overview</CardTitle>
                <div className="flex items-center gap-2">
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
                                    {order.createdAt && formatInIST(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}
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
                                          {ret.createdAt && formatInIST(new Date(ret.createdAt), "MMM dd, yyyy HH:mm")}
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
                                  {returnData.createdAt && formatInIST(new Date(returnData.createdAt), "MMM dd, yyyy HH:mm")}
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