import { mysqlTable, varchar, int, decimal, text, boolean, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------------------- PRODUCTS TABLE ---------------------- */
export const products = mysqlTable("products", {
  id: varchar("id", { length: 36 }).primaryKey(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  brand: varchar("brand", { length: 100 }),
  description: text("description"),

  color: varchar("color", { length: 50 }),
  size: varchar("size", { length: 50 }).notNull(),
  fabric: varchar("fabric", { length: 100 }),
  pattern: varchar("pattern", { length: 100 }),
  gender: varchar("gender", { length: 20 }),

  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  stockQuantity: int("stock_quantity").default(0).notNull(),
  warehouse: varchar("warehouse", { length: 100 }),

  productImage: text("product_image"),
  galleryImages: text("gallery_images"),

  isFeatured: boolean("is_featured").default(false),
  launchDate: timestamp("launch_date"),
  rating: varchar("rating", { length: 10 }),
  tags: text("tags"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertProductSchema = createInsertSchema(products, {
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  color: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  size: z.string().min(1, "Size is required"),

  price: z.string().min(1, "Price is required"),
  stockQuantity: z.number().int().min(0, "Stock quantity must be 0 or greater"),
  productImage: z.string().optional(),
  galleryImages: z.array(z.string()).optional().transform(val => val && val.length > 0 ? JSON.stringify(val) : null).nullable(),
  rating: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  costPrice: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  warehouse: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  fabric: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  pattern: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  description: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  tags: z.array(z.string()).optional().transform(val => val && val.length > 0 ? JSON.stringify(val) : null).nullable(),
  launchDate: z.date().optional().transform(val => val || null).nullable(),
  gender: z.string().transform(val => val === "" ? null : val).nullable().optional(),
}).omit({ id: true, createdAt: true });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

/* ---------------------- ORDERS TABLE ---------------------- */
export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  customerEmail: varchar("customer_email", { length: 150 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  notes: text("notes"),
  subTotal: decimal("sub_total", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertOrderSchema = createInsertSchema(orders, {
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "upi", "bank_transfer", "store_credit", "mixed"]),
  subTotal: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  discountPercentage: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  discountAmount: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  totalAmount: z.string().min(1, "Total amount is required"),
}).omit({ id: true, createdAt: true, orderNumber: true });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

/* ---------------------- ORDER ITEMS TABLE ---------------------- */
export const orderItems = mysqlTable("order_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 }).notNull(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  orderId: z.string().min(1, "Order ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.string().min(1, "Unit price is required"),
  subtotal: z.string().min(1, "Subtotal is required"),
}).omit({ id: true, orderId: true });

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export type OrderWithItems = Order & {
  items: OrderItem[];
};

/* ---------------------- STOCK MOVEMENTS ---------------------- */
export const stockMovements = mysqlTable("stock_movements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertStockMovementSchema = createInsertSchema(stockMovements, {
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().min(1, "Reason is required"),
}).omit({ id: true, createdAt: true });

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

/* ---------------------- STOCK STATS ---------------------- */
export const stockStats = mysqlTable("stock_stats", {
  id: varchar("id", { length: 36 }).primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  available: int("available").default(0).notNull(),
  sold: int("sold").default(0).notNull(),
  returned: int("returned").default(0).notNull(),
  purchased: int("purchased").default(0).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertStockStatsSchema = createInsertSchema(stockStats, {
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
}).omit({ id: true, updatedAt: true });

export type InsertStockStats = z.infer<typeof insertStockStatsSchema>;
export type StockStats = typeof stockStats.$inferSelect;

/* ---------------------- RETURNS ---------------------- */
export const returns = mysqlTable("returns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnNumber: varchar("return_number", { length: 50 }).notNull(),
  orderId: varchar("order_id", { length: 36 }).notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  customerEmail: varchar("customer_email", { length: 150 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash").notNull(),
  notes: text("notes"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  creditAmount: decimal("credit_amount", { precision: 10, scale: 2 }),
  exchangeValue: decimal("exchange_value", { precision: 10, scale: 2 }),
  additionalPayment: decimal("additional_payment", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertReturnSchema = createInsertSchema(returns, {
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  status: z.enum(["pending", "approved", "rejected", "completed"]),
  reason: z.string().min(1, "Return reason is required"),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "upi", "bank_transfer", "store_credit", "mixed"]),
  refundAmount: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  creditAmount: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  exchangeValue: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  additionalPayment: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  notes: z.string().transform(val => val === "" ? null : val).nullable().optional(),
}).omit({ id: true, createdAt: true, returnNumber: true });

export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returns.$inferSelect;

/* ---------------------- RETURN ITEMS ---------------------- */
export const returnItems = mysqlTable("return_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  exchangeProductId: varchar("exchange_product_id", { length: 36 }),
  exchangeProductName: varchar("exchange_product_name", { length: 255 }),
});

export const insertReturnItemSchema = createInsertSchema(returnItems, {
  returnId: z.string().min(1, "Return ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().min(1, "Quantity must be 1 or greater"),
  unitPrice: z.string().min(1, "Unit price is required"),
  exchangeProductId: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  exchangeProductName: z.string().transform(val => val === "" ? null : val).nullable().optional(),
}).omit({ id: true });

export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;
export type ReturnItem = typeof returnItems.$inferSelect;

export type ReturnWithItems = Return & {
  items: ReturnItem[];
};

/* ---------------------- DISCOUNT CODES ---------------------- */
export const discountCodes = mysqlTable("discount_codes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  customerEmail: varchar("customer_email", { length: 150 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes, {
  code: z.string().min(1, "Code is required"),
  customerEmail: z.string().email("Valid email is required"),
  amount: z.string().min(1, "Amount is required"),
  expiresAt: z.date().optional(),
}).omit({ id: true, createdAt: true, isUsed: true, usedAt: true });

export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

/* ---------------------- ACCOUNTS (P&L) TABLE ---------------------- */
export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(),
  referenceId: varchar("reference_id", { length: 36 }),
  referenceNumber: varchar("reference_number", { length: 50 }),

  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0.00").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  profit: decimal("profit", { precision: 10, scale: 2 }).default("0.00").notNull(),

  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0.00"),

  productId: varchar("product_id", { length: 36 }),
  productName: varchar("product_name", { length: 255 }),
  category: varchar("category", { length: 100 }),
  quantity: int("quantity").default(0),

  customerName: varchar("customer_name", { length: 100 }),
  customerEmail: varchar("customer_email", { length: 150 }),

  notes: text("notes"),
  fiscalYear: int("fiscal_year"),
  fiscalMonth: int("fiscal_month"),
  fiscalQuarter: int("fiscal_quarter"),

  transactionDate: timestamp("transaction_date").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Schema for Stock Movements
export const insertStockMovementSchema = createInsertSchema(stockMovements, {
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().min(1, "Reason is required"),
}).omit({ id: true, createdAt: true });

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Schema for Stock Stats
export const insertStockStatsSchema = createInsertSchema(stockStats, {
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
}).omit({ id: true, updatedAt: true });

export type InsertStockStats = z.infer<typeof insertStockStatsSchema>;
export type StockStats = typeof stockStats.$inferSelect;

// Schema for Returns
export const insertReturnSchema = createInsertSchema(returns, {
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  status: z.enum(["pending", "approved", "rejected", "completed"]),
  reason: z.string().min(1, "Return reason is required"),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "upi", "bank_transfer", "store_credit", "mixed"]),
  refundAmount: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  creditAmount: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  exchangeValue: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  additionalPayment: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  notes: z.string().transform(val => val === "" ? null : val).nullable().optional(),
}).omit({ id: true, createdAt: true, returnNumber: true });

export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returns.$inferSelect;

// Schema for Return Items
export const insertReturnItemSchema = createInsertSchema(returnItems, {
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.string().min(1, "Unit price is required"),
  subtotal: z.string().min(1, "Subtotal is required"),
  exchangeProductId: z.string().transform(val => val === "" ? null : val).nullable().optional(),
  exchangeProductName: z.string().transform(val => val === "" ? null : val).nullable().optional(),
}).omit({ 
  id: true, 
  returnId: true 
});

export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;
export type ReturnItem = typeof returnItems.$inferSelect;

export type ReturnWithItems = Return & {
  items: ReturnItem[];
};

// Schema for Discount Codes
export const insertDiscountCodeSchema = createInsertSchema(discountCodes, {
  code: z.string().min(1, "Code is required"),
  customerEmail: z.string().email("Valid email is required"),
  amount: z.string().min(1, "Amount is required"),
  expiresAt: z.date().optional(),
}).omit({ id: true, createdAt: true, isUsed: true, usedAt: true });

export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

export const insertAccountSchema = createInsertSchema(accounts, {
  transactionType: z.enum(["sale", "purchase", "return", "refund", "adjustment", "direct_income"]),
  revenue: z.string().min(1, "Revenue is required"),
  cost: z.string().min(1, "Cost is required"),
  profit: z.string().min(1, "Profit is required"),
  taxAmount: z.string().transform(val => val === "" ? "0.00" : val).optional(),
  discountAmount: z.string().transform(val => val === "" ? "0.00" : val).optional(),
  shippingCost: z.string().transform(val => val === "" ? "0.00" : val).optional(),
  fiscalYear: z.number().int().optional(),
  fiscalMonth: z.number().int().min(1).max(12).optional(),
  fiscalQuarter: z.number().int().min(1).max(4).optional(),
  quantity: z.number().int().min(0).optional(),
  referenceId: z.string().optional(),
  referenceNumber: z.string().optional(),
  productId: z.string().optional(),
  productName: z.string().optional(),
  category: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().transform(val => val === "" ? null : val).nullable().optional(),
}).omit({ id: true, createdAt: true });

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;
