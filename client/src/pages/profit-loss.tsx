
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Calendar, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import type { Product, OrderWithItems, ReturnWithItems, StockMovement, Account } from "@shared/schema.mysql";
import { format, startOfDay, startOfHour, startOfMonth, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { formatInIST } from "@/lib/utils";

type TimeRange = "hourly" | "daily" | "monthly" | "yearly";

interface ProfitData {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
  returns: number;
}

export default function ProfitLoss() {
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  const { data: returns = [], isLoading: returnsLoading } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["/api/stock-movements"],
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const isLoading = productsLoading || ordersLoading || returnsLoading || movementsLoading || accountsLoading;

  // Create a product lookup map for cost prices
  const productMap = useMemo(() => {
    return new Map(products.map(p => [p.id, p]));
  }, [products]);

  // Calculate profit/loss data grouped by time period
  const profitData = useMemo(() => {
    const now = new Date();
    let periods: Date[] = [];
    let formatString = "";

    switch (timeRange) {
      case "hourly":
        // Last 24 hours
        for (let i = 23; i >= 0; i--) {
          const date = new Date(now);
          date.setHours(now.getHours() - i, 0, 0, 0);
          periods.push(date);
        }
        formatString = "HH:00";
        break;
      case "daily":
        // Last 30 days
        for (let i = 29; i >= 0; i--) {
          periods.push(subDays(startOfDay(now), i));
        }
        formatString = "MMM dd";
        break;
      case "monthly":
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
          periods.push(subMonths(startOfMonth(now), i));
        }
        formatString = "MMM yyyy";
        break;
      case "yearly":
        // Last 5 years
        for (let i = 4; i >= 0; i--) {
          periods.push(subYears(startOfYear(now), i));
        }
        formatString = "yyyy";
        break;
    }

    const data: ProfitData[] = periods.map(period => {
      const nextPeriod = new Date(period);
      switch (timeRange) {
        case "hourly":
          nextPeriod.setHours(nextPeriod.getHours() + 1);
          break;
        case "daily":
          nextPeriod.setDate(nextPeriod.getDate() + 1);
          break;
        case "monthly":
          nextPeriod.setMonth(nextPeriod.getMonth() + 1);
          break;
        case "yearly":
          nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);
          break;
      }

      // Filter orders for this period
      const periodOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt!);
        return orderDate >= period && orderDate < nextPeriod;
      });

      // Filter returns for this period
      const periodReturns = returns.filter(r => {
        const returnDate = new Date(r.createdAt!);
        return returnDate >= period && returnDate < nextPeriod;
      });

      // Filter purchase accounts for this period
      const periodPurchases = accounts.filter(a => {
        const txDate = new Date(a.transactionDate!);
        return a.transactionType === "purchase" && txDate >= period && txDate < nextPeriod;
      });

      // Calculate revenue from orders
      const revenue = periodOrders.reduce((sum, order) => {
        return sum + parseFloat(order.totalAmount.toString());
      }, 0);

      // Calculate cost of goods sold
      let cogs = 0;
      periodOrders.forEach(order => {
        order.items.forEach(item => {
          const product = productMap.get(item.productId);
          const costPrice = product?.costPrice ? parseFloat(product.costPrice.toString()) : 0;
          cogs += costPrice * item.quantity;
        });
      });

      // Subtract refunded amounts and add back returned inventory cost
      const refundAmount = periodReturns.reduce((sum, ret) => {
        return sum + (ret.refundAmount ? parseFloat(ret.refundAmount.toString()) : 0);
      }, 0);

      let returnedCost = 0;
      periodReturns.forEach(ret => {
        ret.items.forEach(item => {
          const product = productMap.get(item.productId);
          const costPrice = product?.costPrice ? parseFloat(product.costPrice.toString()) : 0;
          returnedCost += costPrice * item.quantity;
        });
      });

      // Add purchase costs and potential profit from accounts
      const purchaseCost = periodPurchases.reduce((sum, acc) => {
        return sum + parseFloat(acc.cost.toString());
      }, 0);

      const purchaseProfit = periodPurchases.reduce((sum, acc) => {
        return sum + parseFloat(acc.profit.toString());
      }, 0);

      const netRevenue = revenue - refundAmount;
      const netCost = cogs - returnedCost + purchaseCost;
      const profit = netRevenue - netCost + purchaseProfit;

      return {
        period: formatInIST(period, formatString),
        revenue: parseFloat(netRevenue.toFixed(2)),
        cost: parseFloat(netCost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        orders: periodOrders.length,
        returns: periodReturns.length,
      };
    });

    return data;
  }, [orders, returns, productMap, timeRange, accounts]);

  // Payment method statistics
  const paymentMethodStats = useMemo(() => {
    const stats: Record<string, { revenue: number; count: number; refunds: number; refundAmount: number; additionalPayments: number; additionalPaymentAmount: number }> = {
      cash: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      credit_card: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      debit_card: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      upi: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      bank_transfer: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      store_credit: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      mixed: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
    };

    orders.forEach(order => {
      const method = order.paymentMethod || 'cash';
      const amount = parseFloat(order.totalAmount.toString());
      stats[method].revenue += amount;
      stats[method].count += 1;
    });

    returns.forEach(ret => {
      const method = ret.paymentMethod || 'cash';
      // Subtract refunds from revenue
      if (ret.refundAmount) {
        const amount = parseFloat(ret.refundAmount.toString());
        stats[method].revenue -= amount;
        stats[method].refunds += 1;
        stats[method].refundAmount += amount;
      }
      // Add additional payments to revenue
      if (ret.additionalPayment) {
        const amount = parseFloat(ret.additionalPayment.toString());
        stats[method].revenue += amount;
        stats[method].additionalPayments += 1;
        stats[method].additionalPaymentAmount += amount;
      }
    });

    return Object.entries(stats)
      .map(([method, data]) => ({
        method: method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        revenue: data.revenue,
        count: data.count,
        refunds: data.refunds,
        refundAmount: data.refundAmount,
        additionalPayments: data.additionalPayments,
        additionalPaymentAmount: data.additionalPaymentAmount,
        netRevenue: data.revenue + data.refundAmount - data.additionalPaymentAmount
      }))
      .filter(item => item.count > 0 || item.refundAmount !== 0 || item.additionalPaymentAmount !== 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, returns]);

  // Today's earnings when time range is daily
  const todaysEarnings = useMemo(() => {
    if (timeRange !== 'daily') return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt!);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    
    const todaysReturns = returns.filter(ret => {
      const returnDate = new Date(ret.createdAt!);
      returnDate.setHours(0, 0, 0, 0);
      return returnDate.getTime() === today.getTime();
    });
    
    const todaysAccounts = accounts.filter(acc => {
      const txDate = new Date(acc.transactionDate!);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === today.getTime();
    });
    
    // Calculate today's revenue from orders
    const revenue = todaysOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount.toString());
    }, 0);
    
    // Calculate today's refunds
    const refundAmount = todaysReturns.reduce((sum, ret) => {
      return sum + (ret.refundAmount ? parseFloat(ret.refundAmount.toString()) : 0);
    }, 0);
    
    // Calculate today's costs from purchase accounts
    const cost = todaysAccounts.filter(a => a.transactionType === 'purchase').reduce((sum, acc) => {
      return sum + parseFloat(acc.cost.toString());
    }, 0);
    
    // Calculate today's profit
    const profit = revenue - refundAmount - cost;
    
    // Payment methods breakdown for today
    const paymentMethodBreakdown: Record<string, { revenue: number; count: number; refunds: number; refundAmount: number }> = {
      cash: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
      credit_card: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
      debit_card: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
      upi: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
      bank_transfer: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
      store_credit: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
      mixed: { revenue: 0, count: 0, refunds: 0, refundAmount: 0 },
    };
    
    todaysOrders.forEach(order => {
      const method = order.paymentMethod || 'cash';
      const amount = parseFloat(order.totalAmount.toString());
      paymentMethodBreakdown[method].revenue += amount;
      paymentMethodBreakdown[method].count += 1;
    });
    
    todaysReturns.forEach(ret => {
      const method = ret.paymentMethod || 'cash';
      if (ret.refundAmount) {
        const amount = parseFloat(ret.refundAmount.toString());
        paymentMethodBreakdown[method].refunds += 1;
        paymentMethodBreakdown[method].refundAmount += amount;
      }
    });
    
    return {
      revenue,
      refundAmount,
      cost,
      profit,
      paymentMethodBreakdown,
      orderCount: todaysOrders.length,
      returnCount: todaysReturns.length,
    };
  }, [timeRange, orders, returns, accounts]);

  // Calculate overall statistics
  const statistics = useMemo(() => {
    const totalRevenue = profitData.reduce((sum, d) => sum + d.revenue, 0);
    const totalCost = profitData.reduce((sum, d) => sum + d.cost, 0);
    
    // Sales = Total Revenue from orders (stock out)
    const sales = orders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount.toString());
    }, 0);

    // Subtract refunded amounts
    const refundAmount = returns.reduce((sum, ret) => {
      return sum + (ret.refundAmount ? parseFloat(ret.refundAmount.toString()) : 0);
    }, 0);

    const netSales = sales - refundAmount;

    // Purchase = Total cost from purchases (stock in)
    const purchase = accounts
      .filter(a => a.transactionType === "purchase")
      .reduce((sum, a) => {
        return sum + parseFloat(a.cost.toString());
      }, 0);

    // Opening Stock = Total value of initial inventory (can be calculated from first movements or set manually)
    // For now, we'll calculate it based on current stock minus net changes
    const openingStock = products.reduce((sum, product) => {
      const costPrice = product.costPrice ? parseFloat(product.costPrice.toString()) : 0;
      // Get initial quantity (this is simplified - in real scenario, you'd track this separately)
      const currentStock = product.stockQuantity;
      
      // Calculate net sales quantity for this product
      const soldQty = orders.reduce((qty, order) => {
        const item = order.items.find(i => i.productId === product.id);
        return qty + (item ? item.quantity : 0);
      }, 0);
      
      const returnedQty = returns.reduce((qty, ret) => {
        const item = ret.items.find(i => i.productId === product.id);
        return qty + (item ? item.quantity : 0);
      }, 0);
      
      const purchasedQty = movements
        .filter(m => m.productId === product.id && m.type === "in" && m.reason === "purchase")
        .reduce((qty, m) => qty + m.quantity, 0);
      
      // Opening stock = Current stock - Purchase + Sales - Returns
      const openingQty = currentStock - purchasedQty + soldQty - returnedQty;
      return sum + (openingQty * costPrice);
    }, 0);

    // Closing Stock = Current inventory value
    const closingStock = products.reduce((sum, product) => {
      const costPrice = product.costPrice ? parseFloat(product.costPrice.toString()) : 0;
      return sum + (product.stockQuantity * costPrice);
    }, 0);

    // Verify: Closing Stock = Opening Stock + Purchase - Sales (in quantity terms)
    // But we're using value here

    // Direct expenses (additional costs like shipping, handling, etc.)
    // For now, set to 0 as these aren't tracked separately
    const directExpenses = 0;

    // Formula: Gross Profit = Sales + Closing Stock - Opening Stock - Purchase - Direct Expenses
    const grossProfit = netSales + closingStock - openingStock - purchase - directExpenses;
    const grossProfitValue = grossProfit > 0 ? grossProfit : 0;
    const grossLossValue = grossProfit < 0 ? Math.abs(grossProfit) : 0;

    // Indirect income (placeholder - can be expanded)
    const indirectIncome = 0;

    // Indirect expenses (placeholder - can be expanded)
    const indirectExpenses = 0;

    // Formula: Net Profit = Gross Profit + Indirect Income - Indirect Expenses
    const netProfit = grossProfit + indirectIncome - indirectExpenses;
    const netProfitValue = netProfit > 0 ? netProfit : 0;
    const netLossValue = netProfit < 0 ? Math.abs(netProfit) : 0;

    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    const totalOrders = profitData.reduce((sum, d) => sum + d.orders, 0);
    const totalReturns = profitData.reduce((sum, d) => sum + d.returns, 0);
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      sales: netSales,
      purchase,
      openingStock,
      closingStock,
      directExpenses,
      grossProfit: grossProfitValue,
      grossLoss: grossLossValue,
      indirectIncome,
      indirectExpenses,
      netProfit: netProfitValue,
      netLoss: netLossValue,
      profitMargin,
      totalOrders,
      totalReturns,
      returnRate,
    };
  }, [profitData, accounts, productMap, orders, returns, products, movements]);

  // Product category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown = new Map<string, { revenue: number; cost: number; profit: number }>();

    orders.forEach(order => {
      order.items.forEach(item => {
        const product = productMap.get(item.productId);
        if (!product) return;

        const category = product.category;
        const revenue = parseFloat(item.subtotal.toString());
        const costPrice = product.costPrice ? parseFloat(product.costPrice.toString()) : 0;
        const cost = costPrice * item.quantity;
        const profit = revenue - cost;

        const current = breakdown.get(category) || { revenue: 0, cost: 0, profit: 0 };
        breakdown.set(category, {
          revenue: current.revenue + revenue,
          cost: current.cost + cost,
          profit: current.profit + profit,
        });
      });
    });

    return Array.from(breakdown.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));
  }, [orders, productMap]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "#10b981",
    },
    cost: {
      label: "Cost",
      color: "#ef4444",
    },
    profit: {
      label: "Profit",
      color: "#3b82f6",
    },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
                Profit & Loss Statement
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Comprehensive financial analysis and reporting
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time Range:</span>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger className="w-[180px]" data-testid="select-time-range">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly (24h)</SelectItem>
                  <SelectItem value="daily">Daily (30d)</SelectItem>
                  <SelectItem value="monthly">Monthly (12m)</SelectItem>
                  <SelectItem value="yearly">Yearly (5y)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Column 1: Sales & Purchase */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sales</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="stat-sales">
                    ${statistics.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From {statistics.totalOrders} orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Purchase</CardTitle>
                  <Package className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="stat-purchase">
                    ${statistics.purchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From inventory purchases
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Column 2: Gross & Net Profit/Loss */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {statistics.grossProfit > 0 ? "Gross Profit" : "Gross Loss"}
                  </CardTitle>
                  {statistics.grossProfit > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-2xl font-bold ${statistics.grossProfit > 0 ? 'text-green-600' : 'text-red-600'}`} 
                    data-testid="stat-gross-profit"
                  >
                    ${(statistics.grossProfit > 0 ? statistics.grossProfit : statistics.grossLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sales + Closing - Opening - Purchase
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {statistics.netProfit > 0 ? "Net Profit" : "Net Loss"}
                  </CardTitle>
                  {statistics.netProfit > 0 ? (
                    <DollarSign className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-2xl font-bold ${statistics.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`} 
                    data-testid="stat-net-profit"
                  >
                    ${(statistics.netProfit > 0 ? statistics.netProfit : statistics.netLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gross Profit + Indirect Inc - Indirect Exp
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Net Profit Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Net Profit/Loss</CardTitle>
                <CardDescription>Net profit over time</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <LineChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Net Profit" />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Purchase and Sales Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase and Sales</CardTitle>
                <CardDescription>Purchase cost and sales revenue by period</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="cost" fill="#f97316" name="Purchase" />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Sales" />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Earnings when time range is daily */}
          {todaysEarnings && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Today's Earnings</CardTitle>
                <CardDescription>Earnings for {format(new Date(), 'MMMM dd, yyyy')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-800">${todaysEarnings.revenue.toFixed(2)}</p>
                    <p className="text-xs text-blue-500 mt-1">from {todaysEarnings.orderCount} orders</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600 font-medium">Refunds</p>
                    <p className="text-2xl font-bold text-red-800">${todaysEarnings.refundAmount.toFixed(2)}</p>
                    <p className="text-xs text-red-500 mt-1">from {todaysEarnings.returnCount} returns</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-600 font-medium">Cost</p>
                    <p className="text-2xl font-bold text-orange-800">${todaysEarnings.cost.toFixed(2)}</p>
                  </div>
                  <div className={`${todaysEarnings.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} p-4 rounded-lg border`}>
                    <p className={`text-sm font-medium ${todaysEarnings.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit/Loss</p>
                    <p className={`text-2xl font-bold ${todaysEarnings.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>${Math.abs(todaysEarnings.profit).toFixed(2)}</p>
                    <p className={`text-xs ${todaysEarnings.profit >= 0 ? 'text-green-500' : 'text-red-500'} mt-1`}>
                      {todaysEarnings.profit >= 0 ? 'Profit' : 'Loss'}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Payment Method Breakdown</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment Method</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Refunds</TableHead>
                          <TableHead className="text-right">Refund Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(todaysEarnings.paymentMethodBreakdown)
                          .filter(([_, data]) => data.revenue > 0 || data.refundAmount > 0)
                          .map(([method, data]) => (
                            <TableRow key={method}>
                              <TableCell className="font-medium">
                                {method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </TableCell>
                              <TableCell className="text-right">{data.count}</TableCell>
                              <TableCell className="text-right text-green-600 font-semibold">
                                ${data.revenue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">{data.refunds}</TableCell>
                              <TableCell className="text-right text-red-600 font-semibold">
                                ${data.refundAmount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))
                        }
                        {Object.entries(todaysEarnings.paymentMethodBreakdown).filter(([_, data]) => data.revenue > 0 || data.refundAmount > 0).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                              No payment data for today
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Method Statistics */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Payment Method Statistics</CardTitle>
              <CardDescription>Revenue breakdown by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Sales Revenue</TableHead>
                      <TableHead className="text-right">Refunds</TableHead>
                      <TableHead className="text-right">Refund Amount</TableHead>
                      <TableHead className="text-right">Additional Payments</TableHead>
                      <TableHead className="text-right">Add. Payment Amount</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentMethodStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No payment data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      paymentMethodStats.map((item) => {
                        const percentage = statistics.totalRevenue > 0 
                          ? (item.revenue / statistics.totalRevenue) * 100 
                          : 0;
                        return (
                          <TableRow key={item.method}>
                            <TableCell className="font-medium">{item.method}</TableCell>
                            <TableCell className="text-right">{item.count}</TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              ${item.revenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{item.refunds}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">
                              ${item.refundAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{item.additionalPayments}</TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              ${item.additionalPaymentAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${item.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${item.netRevenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={percentage >= 30 ? "default" : "secondary"}>
                                {percentage.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Profit by Category</CardTitle>
                <CardDescription>Revenue distribution across categories</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sales (Revenue)</span>
                  <span className="font-semibold text-blue-600">
                    ${statistics.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Purchase (Cost)</span>
                  <span className="font-semibold text-orange-600">
                    ${statistics.purchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Opening Stock</span>
                  <span className="font-semibold text-purple-600">
                    ${statistics.openingStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Closing Stock</span>
                  <span className="font-semibold text-indigo-600">
                    ${statistics.closingStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Direct Expenses</span>
                  <span className="font-semibold text-red-600">
                    ${statistics.directExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Return Rate</span>
                  <Badge variant={statistics.returnRate > 10 ? "destructive" : "secondary"}>
                    {statistics.returnRate.toFixed(2)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <span className="font-semibold">{statistics.totalOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Returns</span>
                  <span className="font-semibold">{statistics.totalReturns}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Order Value</span>
                  <span className="font-semibold">
                    ${statistics.totalOrders > 0 ? (statistics.sales / statistics.totalOrders).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Net Margin</span>
                  <Badge variant="outline">
                    {statistics.profitMargin.toFixed(2)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
              <CardDescription>Detailed breakdown by product category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryBreakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No category data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      categoryBreakdown.map((item) => {
                        const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
                        return (
                          <TableRow key={item.category}>
                            <TableCell className="font-medium">{item.category}</TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              ${item.revenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">
                              ${item.cost.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${item.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              ${item.profit.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={margin >= 30 ? "default" : margin >= 15 ? "secondary" : "destructive"}>
                                {margin.toFixed(2)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Period Table */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Period Details</CardTitle>
              <CardDescription>Detailed profit/loss by {timeRange} period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Returns</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitData.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.period}</TableCell>
                        <TableCell className="text-right">{item.orders}</TableCell>
                        <TableCell className="text-right">{item.returns}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          ${item.revenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">
                          ${item.cost.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${item.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          ${item.profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
