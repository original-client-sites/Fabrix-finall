
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, Calendar, BarChart3 } from "lucide-react";
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
import { format, parseISO, startOfDay, startOfHour, startOfMonth, startOfYear, subDays, subMonths, subYears } from "date-fns";

type TimeRange = "daily" | "weekly" | "monthly" | "yearly" | "all";

interface ProfitData {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
  returns: number;
}

export default function ProfitLoss() {
  const [timeRange, setTimeRange] = useState<TimeRange>("monthly");

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

  const { data: apiTodaysEarnings = null, isLoading: earningsLoading } = useQuery<{ 
    revenue: number; 
    refundAmount: number; 
    cost: number; 
    profit: number; 
    orderCount: number; 
    returnCount: number; 
    paymentMethodBreakdown: Record<string, { revenue: number; count: number; refunds: number; refundAmount: number }>
  } | null>({
    queryKey: ["/api/todays-earnings"],
    enabled: timeRange === 'daily',
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const isLoading = productsLoading || ordersLoading || returnsLoading || movementsLoading || accountsLoading;

  // Debug: Log data counts and sample dates
  console.log('Data counts:', {
    products: products.length,
    orders: orders.length,
    returns: returns.length,
    accounts: accounts.length,
    isLoading
  });
  
  // Debug: Show sample dates from each dataset
  if (orders.length > 0) {
    console.log('Sample order dates:', orders.slice(0, 3).map(o => ({
      id: o.id,
      date: o.date,
      parsed: o.date ? (typeof o.date === 'string' ? parseISO(o.date).toISOString() : new Date(o.date).toISOString()) : 'null'
    })));
  }
  
  if (returns.length > 0) {
    console.log('Sample return dates:', returns.slice(0, 3).map(r => ({
      id: r.id,
      createdAt: r.createdAt,
      parsed: r.createdAt ? new Date(r.createdAt).toISOString() : 'null'
    })));
  }
  
  if (accounts.length > 0) {
    console.log('Sample account dates:', accounts.slice(0, 3).map(a => ({
      id: a.id,
      transactionDate: a.transactionDate,
      parsed: a.transactionDate ? new Date(a.transactionDate).toISOString() : 'null',
      type: a.transactionType
    })));
  }

  // Create a product lookup map for cost prices
  const productMap = useMemo(() => {
    return new Map(products.map(p => [p.id, p]));
  }, [products]);

  // Calculate the start date based on time range
  const getStartDate = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    switch (timeRange) {
      case "daily":
        d.setHours(0, 0, 0, 0);
        return d;
      case "weekly":
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
      case "monthly":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "yearly":
        return new Date(now.getFullYear(), 0, 1);
      case "all":
        return new Date(0);
      default:
        return new Date(0);
    }
  }, [timeRange]);

  // Calculate profit/loss data grouped by time period
  const profitData = useMemo(() => {
    console.log('Calculating profitData with:', { orders: orders.length, returns: returns.length, accounts: accounts.length, timeRange });
    const now = new Date();
    let periods: Date[] = [];
    let formatString = "";
    let startDate = getStartDate;

    // If timeRange is 'all', show monthly data from the beginning
    if (timeRange === 'all') {
      const allDates = [
        ...orders.filter(o => o.date).map(o => typeof o.date === 'string' ? parseISO(o.date!) : new Date(o.date!)),
        ...returns.filter(r => r.createdAt).map(r => new Date(r.createdAt!)),
        ...accounts.filter(a => a.transactionDate).map(a => new Date(a.transactionDate!))
      ].filter(d => !isNaN(d.getTime()));
      
      if (allDates.length > 0) {
        const earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        startDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
      } else {
        startDate = startOfMonth(now);
      }
      
      const currentDate = new Date(startDate);
      while (currentDate <= now) {
        periods.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      formatString = "MMM yyyy";
    } else {
      switch (timeRange) {
        case "daily":
          // Today - show hourly breakdown
          for (let i = 0; i < 24; i++) {
            const date = new Date(now);
            date.setHours(i, 0, 0, 0);
            periods.push(date);
          }
          formatString = "HH:00";
          break;
        case "weekly":
          // This week (starting Monday)
          const monday = new Date(now);
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          monday.setDate(diff);
          monday.setHours(0, 0, 0, 0);
          
          let curr = new Date(monday);
          while (curr <= now) {
            periods.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
          }
          formatString = "EEE dd";
          break;
        case "monthly":
          // Days in current month
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          for (let i = 1; i <= daysInMonth; i++) {
            periods.push(new Date(now.getFullYear(), now.getMonth(), i));
          }
          formatString = "MMM dd";
          break;
        case "yearly":
          // Months in current year
          for (let i = 0; i < 12; i++) {
            periods.push(new Date(now.getFullYear(), i, 1));
          }
          formatString = "MMM";
          break;
      }
    }

    console.log('Generated periods for', timeRange, ':', periods.map(p => p.toISOString()));
    
    // Log some sample data dates for debugging
    if (orders.length > 0) {
      console.log('Sample order dates (first 5):', orders.slice(0, 5).map(o => ({
        id: o.id,
        date: o.date,
        parsed: o.date ? (typeof o.date === 'string' ? parseISO(o.date).toISOString() : new Date(o.date).toISOString()) : 'null'
      })));
    }
    
    if (returns.length > 0) {
      console.log('Sample return dates (first 5):', returns.slice(0, 5).map(r => ({
        id: r.id,
        date: r.createdAt,
        parsed: r.createdAt ? (typeof r.createdAt === 'string' ? parseISO(r.createdAt).toISOString() : new Date(r.createdAt).toISOString()) : 'null'
      })));
    }

    const data: ProfitData[] = periods.map(period => {
      const nextPeriod = new Date(period);
      switch (timeRange) {
        case "daily":
          nextPeriod.setHours(nextPeriod.getHours() + 1);
          break;
        case "weekly":
        case "monthly":
          nextPeriod.setDate(nextPeriod.getDate() + 1);
          break;
        case "yearly":
          nextPeriod.setMonth(nextPeriod.getMonth() + 1);
          break;
        case "all":
          nextPeriod.setMonth(nextPeriod.getMonth() + 1);
          break;
      }

      // Filter orders for this period
      const periodOrders = orders.filter(o => {
        if (!o.date) return false;
        const orderDate = typeof o.date === 'string' ? parseISO(o.date) : new Date(o.date);
        
        if (timeRange === 'daily') {
          return orderDate >= period && orderDate < nextPeriod;
        }
        
        const normalizedOrderDate = startOfDay(orderDate);
        const normalizedPeriod = startOfDay(period);
        const normalizedNextPeriod = startOfDay(nextPeriod);
        return normalizedOrderDate >= normalizedPeriod && normalizedOrderDate < normalizedNextPeriod;
      });

      // Filter returns for this period
      const periodReturns = returns.filter(r => {
        if (!r.createdAt) return false;
        const returnDate = typeof r.createdAt === 'string' ? parseISO(r.createdAt) : new Date(r.createdAt);
        
        if (timeRange === 'daily') {
          return returnDate >= period && returnDate < nextPeriod;
        }
        
        const normalizedReturnDate = startOfDay(returnDate);
        const normalizedPeriod = startOfDay(period);
        const normalizedNextPeriod = startOfDay(nextPeriod);
        return normalizedReturnDate >= normalizedPeriod && normalizedReturnDate < normalizedNextPeriod;
      });

      // Filter purchase accounts for this period
      const periodPurchases = accounts.filter(a => {
        if (!a.transactionDate) return false;
        const txDate = typeof a.transactionDate === 'string' ? parseISO(a.transactionDate) : new Date(a.transactionDate);
        const isPurchase = a.transactionType === "purchase";
        
        if (timeRange === 'daily') {
          return isPurchase && txDate >= period && txDate < nextPeriod;
        }
        
        const normalizedTxDate = startOfDay(txDate);
        const normalizedPeriod = startOfDay(period);
        const normalizedNextPeriod = startOfDay(nextPeriod);
        return isPurchase && normalizedTxDate >= normalizedPeriod && normalizedTxDate < normalizedNextPeriod;
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

      // Calculate purchase return costs for this period
      const periodPurchaseReturns = movements.filter(m => {
        if (!m.createdAt) return false;
        if (m.type !== "out" || (m.reason !== "purchase return" && m.reason !== "supplier return")) return false;
        const movementDate = typeof m.createdAt === 'string' ? parseISO(m.createdAt) : new Date(m.createdAt);
        return movementDate >= period && movementDate < nextPeriod;
      });
      
      const purchaseReturnCost = periodPurchaseReturns.reduce((sum, m) => {
        const product = productMap.get(m.productId);
        const costPrice = product?.costPrice ? parseFloat(product.costPrice.toString()) : 0;
        return sum + (costPrice * m.quantity);
      }, 0);

      // Add purchase costs and potential profit from accounts
      const purchaseCost = periodPurchases.reduce((sum, acc) => {
        return sum + parseFloat(acc.cost.toString());
      }, 0);

      const purchaseProfit = periodPurchases.reduce((sum, acc) => {
        return sum + parseFloat(acc.profit.toString());
      }, 0);

      const netRevenue = revenue - refundAmount;
      const netCost = cogs - returnedCost + purchaseCost - purchaseReturnCost; // Subtract purchase return costs
      const profit = netRevenue - netCost + purchaseProfit;

      console.log(`Period ${format(period, formatString)}: Orders=${periodOrders.length}, Returns=${periodReturns.length}, Purchases=${periodPurchases.length}`);
      console.log(`  Revenue: ${revenue}, Refunds: ${refundAmount}, Net Revenue: ${netRevenue}`);
      console.log(`  COGS: ${cogs}, Returned Cost: ${returnedCost}, Purchase Cost: ${purchaseCost}, Purchase Return Cost: ${purchaseReturnCost}, Net Cost: ${netCost}`);
      console.log(`  Purchase Profit: ${purchaseProfit}, Final Profit: ${profit}`);

      return {
        period: format(period, formatString),
        revenue: parseFloat(netRevenue.toFixed(2)),
        cost: parseFloat(netCost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        orders: periodOrders.length,
        returns: periodReturns.length,
      };
    });

    console.log('Generated profitData:', data);
    
    // Debug: Check if we have any non-zero values
    const hasNonZeroValues = data.some(d => d.revenue > 0 || d.cost > 0 || d.profit !== 0);
    console.log('Has non-zero values:', hasNonZeroValues);
    if (!hasNonZeroValues && data.length > 0) {
      console.log('All values are zero, checking individual data points:');
      data.forEach((d, i) => {
        console.log(`  Period ${i}:`, d);
      });
    }
    
    return data;
  }, [orders, returns, productMap, timeRange, accounts, getStartDate]);

  // Payment method statistics - with proper mixed payment distribution
  const paymentMethodStats = useMemo(() => {
    const stats: Record<string, { revenue: number; count: number; refunds: number; refundAmount: number; additionalPayments: number; additionalPaymentAmount: number }> = {
      cash: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      credit_card: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      debit_card: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
      upi: { revenue: 0, count: 0, refunds: 0, refundAmount: 0, additionalPayments: 0, additionalPaymentAmount: 0 },
    };

    // Process all orders
    orders.forEach(order => {
      if (order.paymentMethod === 'mixed' && order.payments && order.payments.length > 0) {
        // Distribute mixed payments among the four main categories
        order.payments.forEach(payment => {
          const amount = parseFloat(payment.amount.toString());
          switch (payment.paymentMethod) {
            case 'cash':
              stats.cash.revenue += amount;
              stats.cash.count += 1;
              break;
            case 'credit_card':
              stats.credit_card.revenue += amount;
              stats.credit_card.count += 1;
              break;
            case 'debit_card':
              stats.debit_card.revenue += amount;
              stats.debit_card.count += 1;
              break;
            case 'upi':
              stats.upi.revenue += amount;
              stats.upi.count += 1;
              break;
            case 'bank_transfer':
              // Bank transfer goes to UPI category
              stats.upi.revenue += amount;
              stats.upi.count += 1;
              break;
            case 'store_credit':
              // Store credit goes to cash category
              stats.cash.revenue += amount;
              stats.cash.count += 1;
              break;
            default:
              // Default to cash for unknown methods
              stats.cash.revenue += amount;
              stats.cash.count += 1;
              break;
          }
        });
      } else {
        // Regular (non-mixed) payments
        const method = order.paymentMethod || 'cash';
        const amount = parseFloat(order.totalAmount.toString());
        
        switch (method) {
          case 'cash':
            stats.cash.revenue += amount;
            stats.cash.count += 1;
            break;
          case 'credit_card':
            stats.credit_card.revenue += amount;
            stats.credit_card.count += 1;
            break;
          case 'debit_card':
            stats.debit_card.revenue += amount;
            stats.debit_card.count += 1;
            break;
          case 'upi':
            stats.upi.revenue += amount;
            stats.upi.count += 1;
            break;
          case 'bank_transfer':
            // Bank transfer goes to UPI category
            stats.upi.revenue += amount;
            stats.upi.count += 1;
            break;
          case 'store_credit':
            // Store credit goes to cash category
            stats.cash.revenue += amount;
            stats.cash.count += 1;
            break;
          default:
            // Default to cash for unknown methods
            stats.cash.revenue += amount;
            stats.cash.count += 1;
            break;
        }
      }
    });

    // Process returns
    returns.forEach(ret => {
      const method = ret.paymentMethod || 'cash';
      // Subtract refunds from revenue
      if (ret.refundAmount) {
        const amount = parseFloat(ret.refundAmount.toString());
        
        switch (method) {
          case 'cash':
          case 'store_credit':
            stats.cash.revenue -= amount;
            stats.cash.refunds += 1;
            stats.cash.refundAmount += amount;
            break;
          case 'credit_card':
            stats.credit_card.revenue -= amount;
            stats.credit_card.refunds += 1;
            stats.credit_card.refundAmount += amount;
            break;
          case 'debit_card':
            stats.debit_card.revenue -= amount;
            stats.debit_card.refunds += 1;
            stats.debit_card.refundAmount += amount;
            break;
          case 'upi':
          case 'bank_transfer':
            stats.upi.revenue -= amount;
            stats.upi.refunds += 1;
            stats.upi.refundAmount += amount;
            break;
          default:
            stats.cash.revenue -= amount;
            stats.cash.refunds += 1;
            stats.cash.refundAmount += amount;
            break;
        }
      }
      // Add additional payments to revenue
      if (ret.additionalPayment) {
        const amount = parseFloat(ret.additionalPayment.toString());
        
        switch (method) {
          case 'cash':
          case 'store_credit':
            stats.cash.revenue += amount;
            stats.cash.additionalPayments += 1;
            stats.cash.additionalPaymentAmount += amount;
            break;
          case 'credit_card':
            stats.credit_card.revenue += amount;
            stats.credit_card.additionalPayments += 1;
            stats.credit_card.additionalPaymentAmount += amount;
            break;
          case 'debit_card':
            stats.debit_card.revenue += amount;
            stats.debit_card.additionalPayments += 1;
            stats.debit_card.additionalPaymentAmount += amount;
            break;
          case 'upi':
          case 'bank_transfer':
            stats.upi.revenue += amount;
            stats.upi.additionalPayments += 1;
            stats.upi.additionalPaymentAmount += amount;
            break;
          default:
            stats.cash.revenue += amount;
            stats.cash.additionalPayments += 1;
            stats.cash.additionalPaymentAmount += amount;
            break;
        }
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
        netRevenue: data.revenue - data.refundAmount + data.additionalPaymentAmount
      }))
      .filter(item => item.revenue > 0 || item.refundAmount > 0 || item.additionalPaymentAmount > 0)
      .sort((a, b) => b.netRevenue - a.netRevenue);
  }, [orders, returns]);

  // Today's earnings when time range is daily
  const todaysEarnings = useMemo(() => {
    if (timeRange !== 'daily') return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysOrders = orders.filter(order => {
      if (!order.date) return false;
      const orderDate = typeof order.date === 'string' ? parseISO(order.date) : new Date(order.date);
      // Normalize both dates to same day by comparing year, month, and date
      return orderDate.getFullYear() === today.getFullYear() &&
             orderDate.getMonth() === today.getMonth() &&
             orderDate.getDate() === today.getDate();
    });
    
    const todaysReturns = returns.filter(ret => {
      if (!ret.createdAt) return false;
      const returnDate = new Date(ret.createdAt);
      // Normalize both dates to same day by comparing year, month, and date
      return returnDate.getFullYear() === today.getFullYear() &&
             returnDate.getMonth() === today.getMonth() &&
             returnDate.getDate() === today.getDate();
    });
    
    const todaysAccounts = accounts.filter(acc => {
      if (!acc.transactionDate) return false;
      const txDate = new Date(acc.transactionDate);
      // Normalize both dates to same day by comparing year, month, and date
      return txDate.getFullYear() === today.getFullYear() &&
             txDate.getMonth() === today.getMonth() &&
             txDate.getDate() === today.getDate();
    });
    
    // Calculate today's revenue from orders
    const revenue = todaysOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount.toString());
    }, 0);
    
    // Calculate today's refunds
    const refundAmount = todaysReturns.reduce((sum, ret) => {
      return sum + (ret.refundAmount ? parseFloat(ret.refundAmount.toString()) : 0);
    }, 0);
    
    // Calculate today's purchase return costs
    const todaysPurchaseReturns = movements.filter(m => {
      if (!m.createdAt) return false;
      if (m.type !== "out" || (m.reason !== "purchase return" && m.reason !== "supplier return")) return false;
      const movementDate = new Date(m.createdAt);
      // Normalize both dates to same day by comparing year, month, and date
      return movementDate.getFullYear() === today.getFullYear() &&
             movementDate.getMonth() === today.getMonth() &&
             movementDate.getDate() === today.getDate();
    });
    
    const purchaseReturnCost = todaysPurchaseReturns.reduce((sum, m) => {
      const product = productMap.get(m.productId);
      const costPrice = product?.costPrice ? parseFloat(product.costPrice.toString()) : 0;
      return sum + (costPrice * m.quantity);
    }, 0);
    
    // Calculate today's costs from purchase accounts
    const purchaseCost = todaysAccounts.filter(a => a.transactionType === 'purchase').reduce((sum, acc) => {
      return sum + parseFloat(acc.cost.toString());
    }, 0);
    
    // Calculate today's profit (adjusted to include purchase return costs)
    const cost = purchaseCost - purchaseReturnCost; // Subtract purchase return costs
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
    
    // Process regular (non-mixed) orders
    const regularOrders = todaysOrders.filter(order => order.paymentMethod !== 'mixed');
    regularOrders.forEach(order => {
      const method = order.paymentMethod || 'cash';
      const amount = parseFloat(order.totalAmount.toString());
      paymentMethodBreakdown[method].revenue += amount;
      paymentMethodBreakdown[method].count += 1;
    });
    
    // Process mixed payment orders (if payment details are available)
    const mixedOrders = todaysOrders.filter(order => order.paymentMethod === 'mixed');
    mixedOrders.forEach(order => {
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach(payment => {
          const method = payment.paymentMethod;
          const amount = parseFloat(payment.amount.toString());
          paymentMethodBreakdown[method].revenue += amount;
          paymentMethodBreakdown[method].count += 1;
        });
      } else {
        // Fallback: if no payment details, count as mixed
        const amount = parseFloat(order.totalAmount.toString());
        paymentMethodBreakdown.mixed.revenue += amount;
        paymentMethodBreakdown.mixed.count += 1;
      }
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
    const filteredOrders = orders.filter(o => {
      if (!o.date) return false;
      const orderDate = typeof o.date === 'string' ? parseISO(o.date) : new Date(o.date);
      return orderDate >= getStartDate;
    });

    const sales = filteredOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount.toString());
    }, 0);

    const filteredReturns = returns.filter(r => {
      if (!r.createdAt) return false;
      const returnDate = typeof r.createdAt === 'string' ? parseISO(r.createdAt) : new Date(r.createdAt);
      return returnDate >= getStartDate;
    });

    const refundAmount = filteredReturns.reduce((sum, ret) => {
      return sum + (ret.refundAmount ? parseFloat(ret.refundAmount.toString()) : 0);
    }, 0);

    const netSales = sales - refundAmount;

    // Purchase = Total cost from purchases (stock in)
    const filteredAccounts = accounts.filter(a => {
      if (!a.transactionDate) return false;
      const txDate = typeof a.transactionDate === 'string' ? parseISO(a.transactionDate) : new Date(a.transactionDate);
      return txDate >= getStartDate;
    });

    const purchase = filteredAccounts
      .filter(a => a.transactionType === "purchase")
      .reduce((sum, a) => {
        return sum + parseFloat(a.cost.toString());
      }, 0);

    const filteredMovements = movements.filter(m => {
      if (!m.createdAt) return false;
      const movementDate = typeof m.createdAt === 'string' ? parseISO(m.createdAt) : new Date(m.createdAt);
      return movementDate >= getStartDate;
    });

    const purchaseReturnCost = filteredMovements
      .filter(m => m.type === "out" && (m.reason === "purchase return" || m.reason === "supplier return"))
      .reduce((sum, m) => {
        const product = productMap.get(m.productId);
        const costPrice = product?.costPrice ? parseFloat(product.costPrice.toString()) : 0;
        return sum + (costPrice * m.quantity);
      }, 0);

    // Calculation for Opening and Closing stock for the period
    const openingStock = products.reduce((sum, product) => {
      const costPrice = product.costPrice ? parseFloat(product.costPrice.toString()) : 0;
      const currentStock = product.stockQuantity;
      
      // All activity AFTER startDate
      const soldAfter = orders.filter(o => o.date && (typeof o.date === 'string' ? parseISO(o.date) : new Date(o.date)) >= getStartDate)
        .reduce((qty, order) => qty + (order.items.find(i => i.productId === product.id)?.quantity || 0), 0);
      
      const returnedAfter = returns.filter(r => r.createdAt && new Date(r.createdAt) >= getStartDate)
        .reduce((qty, ret) => qty + (ret.items.find(i => i.productId === product.id)?.quantity || 0), 0);
      
      const purchasedAfter = movements.filter(m => m.productId === product.id && m.type === "in" && m.reason === "purchase" && (m.createdAt ? (typeof m.createdAt === 'string' ? parseISO(m.createdAt) : new Date(m.createdAt)) : new Date()) >= getStartDate)
        .reduce((qty, m) => qty + m.quantity, 0);
        
      const purchaseReturnAfter = movements.filter(m => m.productId === product.id && m.type === "out" && (m.reason === "purchase return" || m.reason === "supplier return") && (m.createdAt ? (typeof m.createdAt === 'string' ? parseISO(m.createdAt) : new Date(m.createdAt)) : new Date()) >= getStartDate)
        .reduce((qty, m) => qty + m.quantity, 0);

      // Stock at start = Current Stock - Net Change since start
      // change = purchase - sales + returns - purchaseReturns
      const netChangeSinceStart = purchasedAfter - soldAfter + returnedAfter - purchaseReturnAfter;
      const openingQty = currentStock - netChangeSinceStart;
      return sum + (Math.max(0, openingQty) * costPrice);
    }, 0);

    const closingStock = products.reduce((sum, product) => {
      const costPrice = product.costPrice ? parseFloat(product.costPrice.toString()) : 0;
      return sum + (product.stockQuantity * costPrice);
    }, 0);

    // Verify: Closing Stock = Opening Stock + Purchase - Sales (in quantity terms)
    // But we're using value here

    // Direct expenses (additional costs like shipping, handling, etc.)
    // For now, set to 0 as these aren't tracked separately
    const directExpenses = 0;

    // Formula: Gross Profit = Sales + Closing Stock - Opening Stock - (Purchase - Purchase Returns) - Direct Expenses
    const adjustedPurchase = purchase - purchaseReturnCost;
    const grossProfit = netSales + closingStock - openingStock - adjustedPurchase - directExpenses;
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
    const totalPurchaseReturns = movements.filter(m => m.type === "out" && (m.reason === "purchase return" || m.reason === "supplier return")).length;
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      sales: netSales,
      purchase,
      purchaseReturnCost,
      adjustedPurchase,
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
      totalPurchaseReturns,
      returnRate,
    };
  }, [profitData, accounts, productMap, orders, returns, products, movements, getStartDate]);

  // Calculate time-range specific statistics for the 4 cards
  const timeRangeStatistics = useMemo(() => {
    // Sum up the values from the profitData for the selected time range
    const timeRangeRevenue = profitData.reduce((sum, d) => sum + d.revenue, 0);
    const timeRangeCost = profitData.reduce((sum, d) => sum + d.cost, 0);
    const timeRangeProfit = profitData.reduce((sum, d) => sum + d.profit, 0);
    const timeRangeOrders = profitData.reduce((sum, d) => sum + d.orders, 0);
    
    // Calculate total items sold (stock out) in this time range
    const totalItemsSold = orders
      .filter(order => {
        if (!order.date) return false;
        const orderDate = typeof order.date === 'string' ? parseISO(order.date) : new Date(order.date);
        return orderDate >= getStartDate;
      })
      .reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }, 0);
    
    // Calculate total items added as stock (purchases) in this time range
    const totalItemsAdded = movements
      .filter(m => {
        if (!m.createdAt) return false;
        if (m.type !== 'in') return false;
        const movementDate = typeof m.createdAt === 'string' ? parseISO(m.createdAt) : new Date(m.createdAt);
        return movementDate >= getStartDate && (m.reason === 'purchase' || m.reason === 'initial stock');
      })
      .reduce((sum, m) => sum + m.quantity, 0);
    
    // Determine labels based on profit/loss
    const grossProfitLabel = timeRangeProfit >= 0 ? "Gross Profit" : "Gross Loss";
    const netProfitLabel = timeRangeProfit >= 0 ? "Net Profit" : "Net Loss";
    const grossValue = timeRangeProfit >= 0 ? timeRangeProfit : Math.abs(timeRangeProfit);
    const netValue = timeRangeProfit >= 0 ? timeRangeProfit : Math.abs(timeRangeProfit);
    
    return {
      sales: timeRangeRevenue,
      purchase: timeRangeCost,
      grossProfit: grossValue,
      grossLoss: grossValue,
      grossProfitLabel,
      netProfit: netValue,
      netLoss: netValue,
      netProfitLabel,
      totalOrders: timeRangeOrders,
      totalItemsSold,
      totalItemsAdded,
    };
  }, [profitData, orders, movements, getStartDate]);

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

    // Add purchase return costs by category
    movements.forEach(movement => {
      if (movement.type === "out" && (movement.reason === "purchase return" || movement.reason === "supplier return")) {
        const product = productMap.get(movement.productId);
        if (!product) return;

        const category = product.category;
        const costPrice = product.costPrice ? parseFloat(product.costPrice.toString()) : 0;
        const cost = costPrice * movement.quantity;
        
        const current = breakdown.get(category) || { revenue: 0, cost: 0, profit: 0 };
        breakdown.set(category, {
          revenue: current.revenue, // Don't change revenue
          cost: current.cost - cost, // Subtract the cost (as it's a return)
          profit: current.profit - cost, // Subtract the cost from profit
        });
      }
    });

    return Array.from(breakdown.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));
  }, [orders, movements, productMap]);

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
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="yearly">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
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
                    ₹{timeRangeStatistics.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRangeStatistics.totalItemsSold} units sold
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
                    ₹{timeRangeStatistics.purchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRangeStatistics.totalItemsAdded} units added
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Column 2: Gross & Net Profit/Loss */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {timeRangeStatistics.grossProfitLabel}
                  </CardTitle>
                  {timeRangeStatistics.grossProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-2xl font-bold ${timeRangeStatistics.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} 
                    data-testid="stat-gross-profit"
                  >
                    ₹{timeRangeStatistics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRange === 'all' ? 'From start to end' : `Based on ${timeRange} data`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {timeRangeStatistics.netProfitLabel}
                  </CardTitle>
                  {timeRangeStatistics.netProfit >= 0 ? (
                    <IndianRupee className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-2xl font-bold ${timeRangeStatistics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} 
                    data-testid="stat-net-profit"
                  >
                    ₹{timeRangeStatistics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRange === 'all' ? 'From start to end' : `Based on ${timeRange} data`}
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
          {(apiTodaysEarnings || (timeRange === 'daily' && !earningsLoading)) && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Today's Earnings</CardTitle>
                <CardDescription>Earnings for {format(new Date(), 'MMMM dd, yyyy')}</CardDescription>
              </CardHeader>
              <CardContent>
                {earningsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : apiTodaysEarnings ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                        <p className="text-2xl font-bold text-blue-800">₹{(apiTodaysEarnings as any).revenue.toFixed(2)}</p>
                        <p className="text-xs text-blue-500 mt-1">from {(apiTodaysEarnings as any).orderCount} orders</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <p className="text-sm text-red-600 font-medium">Refunds</p>
                        <p className="text-2xl font-bold text-red-800">₹{(apiTodaysEarnings as any).refundAmount.toFixed(2)}</p>
                        <p className="text-xs text-red-500 mt-1">from {(apiTodaysEarnings as any).returnCount} returns</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-600 font-medium">Cost</p>
                        <p className="text-2xl font-bold text-orange-800">₹{(apiTodaysEarnings as any).cost.toFixed(2)}</p>
                      </div>
                      <div className={`${(apiTodaysEarnings as any).profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} p-4 rounded-lg border`}>
                        <p className={`text-sm font-medium ${(apiTodaysEarnings as any).profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit/Loss</p>
                        <p className={`text-2xl font-bold ${(apiTodaysEarnings as any).profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>₹{Math.abs((apiTodaysEarnings as any).profit).toFixed(2)}</p>
                        <p className={`text-xs ${(apiTodaysEarnings as any).profit >= 0 ? 'text-green-500' : 'text-red-500'} mt-1`}>
                          {(apiTodaysEarnings as any).profit >= 0 ? 'Profit' : 'Loss'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Payment Method Breakdown</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {Object.entries((apiTodaysEarnings as any).paymentMethodBreakdown)
                          .filter(([_, data]: [string, any]) => data.revenue > 0 || data.refundAmount > 0)
                          .map(([method, data]: [string, any]) => {
                            const methodName = method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            const isPositive = data.revenue - data.refundAmount > 0;
                            return (
                              <Card key={method} className="border shadow-sm">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-center">{methodName}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-center space-y-1">
                                    <div className="text-2xl font-bold" style={{ color: isPositive ? '#10b981' : '#ef4444' }}>
                                      ₹{Math.abs(data.revenue - data.refundAmount).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {data.count} sale{data.count !== 1 ? 's' : ''}
                                    </div>
                                    {data.refunds > 0 && (
                                      <div className="text-xs text-red-500">
                                        {data.refunds} refund{data.refunds !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        }
                        {Object.entries((apiTodaysEarnings as any).paymentMethodBreakdown).filter(([_, data]: [string, any]) => data.revenue > 0 || data.refundAmount > 0).length === 0 && (
                          <div className="col-span-full text-center py-8 text-muted-foreground">
                            No payment data for today
                          </div>
                        )}
                      </div>
                      
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Payment Method</TableHead>
                              <TableHead className="text-right">Sales Count</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Refunds Count</TableHead>
                              <TableHead className="text-right">Refund Amount</TableHead>
                              <TableHead className="text-right">Net Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries((apiTodaysEarnings as any).paymentMethodBreakdown)
                              .filter(([method, data]: [string, any]) => data.revenue > 0 || data.refundAmount > 0)
                              .filter(([method, data]: [string, any]) => method !== 'mixed')
                              .map(([method, data]: [string, any]) => (
                                <TableRow key={method}>
                                  <TableCell className="font-medium">
                                    {method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </TableCell>
                                  <TableCell className="text-right">{data.count}</TableCell>
                                  <TableCell className="text-right text-green-600 font-semibold">
                                    ₹{data.revenue.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">{data.refunds}</TableCell>
                                  <TableCell className="text-right text-red-600 font-semibold">
                                    ₹{data.refundAmount.toFixed(2)}
                                  </TableCell>
                                  <TableCell className={`text-right font-semibold ${data.revenue - data.refundAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₹{(data.revenue - data.refundAmount).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))
                            }
                            {Object.entries((apiTodaysEarnings as any).paymentMethodBreakdown).filter(([method, data]: [string, any]) => (data.revenue > 0 || data.refundAmount > 0) && method !== 'mixed').length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                  No payment data for today
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                ) : null}
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
                              ₹{item.revenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{item.refunds}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">
                              ₹{item.refundAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{item.additionalPayments}</TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              ₹{item.additionalPaymentAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${item.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ₹{item.netRevenue.toFixed(2)}
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
                    ₹{statistics.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Purchase (Cost)</span>
                  <span className="font-semibold text-orange-600">
                    ₹{statistics.purchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Purchase Returns (Cost)</span>
                  <span className="font-semibold text-red-600">
                    ₹{statistics.purchaseReturnCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Adjusted Purchase</span>
                  <span className="font-semibold text-purple-600">
                    ₹{statistics.adjustedPurchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Opening Stock</span>
                  <span className="font-semibold text-purple-600">
                    ₹{statistics.openingStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Closing Stock</span>
                  <span className="font-semibold text-indigo-600">
                    ₹{statistics.closingStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Direct Expenses</span>
                  <span className="font-semibold text-red-600">
                    ₹{statistics.directExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <span className="text-sm text-muted-foreground">Total Purchase Returns</span>
                  <span className="font-semibold">{statistics.totalPurchaseReturns}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Order Value</span>
                  <span className="font-semibold">
                    ₹{statistics.totalOrders > 0 ? (statistics.sales / statistics.totalOrders).toFixed(2) : '0.00'}
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
                              ₹{item.revenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">
                              ₹{item.cost.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${item.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              ₹{item.profit.toFixed(2)}
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
                          ₹{item.revenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">
                          ₹{item.cost.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${item.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          ₹{item.profit.toFixed(2)}
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
