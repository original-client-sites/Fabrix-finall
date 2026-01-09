import { useState } from "react";
import { format } from "date-fns";
import { formatInIST } from "@/lib/utils";
import { Calendar, Package, User, Mail, Phone, Download, RotateCcw, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreateReturnDialog } from "./create-return-dialog";
import { useQuery } from "@tanstack/react-query";
import type { OrderWithItems, ReturnWithItems } from "@shared/schema";

interface OrderCardProps {
  order: OrderWithItems;
}

const statusVariants = {
  pending: "secondary" as const,
  processing: "default" as const,
  shipped: "default" as const,
  delivered: "default" as const,
  cancelled: "destructive" as const,
};

export function OrderCard({ order }: OrderCardProps) {
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: returns = [] } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  });

  const orderReturns = returns.filter(ret => ret.orderId === order.id);

  const downloadInvoice = async () => {
    try {
      const response = await fetch(`/api/orders/${order.id}/invoice`);
      if (!response.ok) throw new Error('Failed to download invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Invoice downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download invoice",
        variant: "destructive",
      });
    }
  };

  const downloadReturnInvoice = async (returnId: string, returnNumber: string) => {
    try {
      const response = await fetch(`/api/returns/${returnId}/invoice`);
      if (!response.ok) throw new Error('Failed to download return invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `return-invoice-${returnNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Return invoice downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download return invoice",
        variant: "destructive",
      });
    }
  };

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
    <>
    <Card className="hover-elevate transition-all" data-testid={`card-order-${order.id}`}>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg font-mono" data-testid={`text-order-number-${order.id}`}>
                  #{order.orderNumber}
                </h3>
                <Badge variant={statusVariants[order.status as keyof typeof statusVariants]} data-testid={`badge-status-${order.id}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span data-testid={`text-customer-${order.id}`}>{order.customerName}</span>
                </div>
                {order.createdAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span data-testid={`text-date-${order.id}`}>
                      {order.createdAt ? formatInIST(new Date(order.createdAt), "MMM dd, yyyy") : 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
              <p className="text-2xl font-bold" data-testid={`text-total-${order.id}`}>${order.totalAmount}</p>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div>
              <p className="text-sm text-muted-foreground mb-1">Items</p>
              <p className="text-lg font-semibold" data-testid={`text-items-count-${order.id}`}>
                {order.items.length} {order.items.length === 1 ? "item" : "items"}
              </p>
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={
                  order.status === "delivered" ? "default" :
                  order.status === "shipped" ? "secondary" :
                  order.status === "processing" ? "outline" :
                  order.status === "cancelled" ? "destructive" :
                  "secondary"
                }>
                  {order.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-semibold capitalize">
                  {(order.paymentMethod || 'cash').replace(/_/g, ' ')}
                </p>
              </div>
          </div>
        </div>

        {order.items.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Order Items:</p>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                  data-testid={`order-item-${order.id}-${index}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      ({item.sku})
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-muted-foreground">Qty: {item.quantity}</span>
                    <span className="font-medium min-w-[80px] text-right">${item.subtotal}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-1">Notes:</p>
            <p className="text-sm text-muted-foreground" data-testid={`text-notes-${order.id}`}>{order.notes}</p>
          </div>
        )}

        {orderReturns.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3">Return/Exchange History:</p>
            <div className="space-y-3">
              {orderReturns.map((ret) => (
                <div key={ret.id} className="bg-muted/50 p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{ret.returnNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {ret.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ret.createdAt ? formatInIST(new Date(ret.createdAt), "MMM dd, yyyy") : 'N/A'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {ret.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-muted-foreground">Returned: </span>
                          <span>{item.productName} (x{item.quantity})</span>
                          {item.exchangeProductName && (
                            <div className="ml-2 text-xs text-blue-600">
                              ↻ Exchanged for: {item.exchangeProductName}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/50 text-sm">
                    <div className="space-y-1">
                      {ret.exchangeValue && parseFloat(ret.exchangeValue) > 0 && (
                        <div className="text-muted-foreground">
                          Exchange Value: <span className="font-medium">${ret.exchangeValue}</span>
                        </div>
                      )}
                      {ret.refundAmount && parseFloat(ret.refundAmount) > 0 && (
                        <div className="text-green-600">
                          Refunded: <span className="font-semibold">${ret.refundAmount}</span>
                        </div>
                      )}
                      {ret.additionalPayment && parseFloat(ret.additionalPayment) > 0 && (
                        <div className="text-orange-600">
                          Additional Payment: <span className="font-semibold">${ret.additionalPayment}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadReturnInvoice(ret.id, ret.returnNumber)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Invoice
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <div className="mt-4 pt-4 border-t flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadInvoice}
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Invoice
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReturnDialogOpen(true)}
          className="flex-1"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Create Return
        </Button>
      </div>
    </Card>

    <CreateReturnDialog
      open={returnDialogOpen}
      onOpenChange={setReturnDialogOpen}
      order={order}
    />
    </>
  );
}