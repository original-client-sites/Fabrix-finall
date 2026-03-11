import { Package, ShoppingCart, TrendingUp, Ticket, BarChart3, FileText } from "lucide-react";
import { Link, useRoute } from "wouter";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [isInventory] = useRoute("/");
  const [isOrders] = useRoute("/orders");
  const [isStock] = useRoute("/stock-history");
  const [isStoreCredits] = useRoute("/store-credits");
  const [isProfitLoss] = useRoute("/profit-loss");
  const [isOrderSummary] = useRoute("/order-summary");


  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">FABRIX</span>
            </div>
            <div className="flex gap-1">
              <Link href="/">
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isInventory
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Package className="h-4 w-4" />
                  <span>Inventory</span>
                </div>
              </Link>
              <Link href="/orders">
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isOrders
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Orders</span>
                </div>
              </Link>
              <Link href="/stock-history">
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isStock
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Stock History</span>
                </div>
              </Link>
              <Link href="/store-credits">
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isStoreCredits
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Ticket className="h-4 w-4" />
                  <span>Store Credits</span>
                </div>
              </Link>
              <Link href="/profit-loss">
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isProfitLoss
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Profit & Loss</span>
                </div>
              </Link>
              <Link href="/order-summary">
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                    isOrderSummary
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  <span>Order Summary</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}