
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Search, Ticket, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DiscountCode } from "@shared/schema";
import { format } from "date-fns";
import { formatInIST } from "@/lib/utils";
import { CreateOrderDialog } from "@/components/create-order-dialog";
import { UseCreditDialog } from "@/components/use-credit-dialog";

export default function StoreCredits() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCredit, setSelectedCredit] = useState<DiscountCode | null>(null);
  const [useCreditDialogOpen, setUseCreditDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: discountCodes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ["/api/discount-codes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/discount-codes/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-codes"] });
      toast({
        title: "Deleted",
        description: "Store credit has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete store credit",
        variant: "destructive",
      });
    },
  });

  const filteredCodes = discountCodes.filter((code) => {
    const matchesSearch =
      code.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Check if a discount code is considered "used" - either isUsed flag or amount is 0
  const isCodeUsed = (code: typeof discountCodes[0]) => {
    return code.isUsed || parseFloat(code.amount) <= 0;
  };

  const unusedCodes = filteredCodes.filter((code) => !isCodeUsed(code));
  const usedCodes = filteredCodes.filter((code) => isCodeUsed(code));

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Store Credits</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage customer store credit discount codes
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer email or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Ticket className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Active Store Credits</h2>
                <span className="text-sm text-muted-foreground">
                  ({unusedCodes.length})
                </span>
              </div>

              {isLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">Loading...</p>
                  </CardContent>
                </Card>
              ) : unusedCodes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-muted p-6 mb-4">
                      <Ticket className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No active store credits</h3>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? "No store credits match your search"
                        : "Store credits will appear here when returns are processed"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer Email</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Credit Amount</TableHead>
                          <TableHead>Issued Date</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unusedCodes.map((code) => (
                          <TableRow key={code.id}>
                            <TableCell className="font-medium">
                              {code.customerEmail}
                            </TableCell>
                            <TableCell>
                              <code className="bg-muted px-2 py-1 rounded text-sm">
                                {code.code}
                              </code>
                            </TableCell>
                            <TableCell className="text-green-600 font-semibold">
                              ${parseFloat(code.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {code.createdAt
                                ? formatInIST(new Date(code.createdAt), "MMM dd, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {code.expiresAt
                                ? formatInIST(new Date(code.expiresAt), "MMM dd, yyyy")
                                : "No expiry"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCredit(code);
                                    setUseCreditDialogOpen(true);
                                  }}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Use
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(code.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>

            {usedCodes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Ticket className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold text-muted-foreground">
                    Used Store Credits
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({usedCodes.length})
                  </span>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer Email</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Credit Amount</TableHead>
                          <TableHead>Issued Date</TableHead>
                          <TableHead>Used Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usedCodes.map((code) => (
                          <TableRow key={code.id} className="opacity-60">
                            <TableCell className="font-medium">
                              {code.customerEmail}
                            </TableCell>
                            <TableCell>
                              <code className="bg-muted px-2 py-1 rounded text-sm line-through">
                                {code.code}
                              </code>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              ${parseFloat(code.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {code.createdAt
                                ? formatInIST(new Date(code.createdAt), "MMM dd, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {code.usedAt
                                ? formatInIST(new Date(code.usedAt), "MMM dd, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(code.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      <UseCreditDialog
        open={useCreditDialogOpen}
        onOpenChange={setUseCreditDialogOpen}
        credit={selectedCredit}
      />
    </div>
  );
}
