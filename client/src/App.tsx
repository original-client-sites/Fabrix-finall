import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Inventory from "@/pages/inventory";
import Orders from "@/pages/orders";
import StockHistory from "@/pages/stock-history";
import StoreCredits from "@/pages/store-credits";
import ProfitLoss from "@/pages/profit-loss";
import OrderSummary from "@/pages/order-summary";
import NotFound from "@/pages/not-found";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Inventory} />
      <Route path="/orders" component={Orders} />
      <Route path="/stock-history" component={StockHistory} />
      <Route path="/store-credits" component={StoreCredits} />
      <Route path="/profit-loss" component={ProfitLoss} />
      <Route path="/order-summary" component={OrderSummary} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen">
          <Navigation />
          <main className="flex-1 overflow-hidden">
            <Router />
          </main>
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;