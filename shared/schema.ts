import { pgTable, varchar, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------------------- PRODUCTS TABLE ---------------------- */
export const products = pgTable("products", {
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

  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
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
export const orders = pgTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  customerEmail: varchar("customer_email", { length: 150 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash").notNull(),
  notes: text("notes"),
  subTotal: numeric("sub_total", { precision: 10, scale: 2 }),
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").default(sql`CURRENT_TIMESTAMP`),  // Changed column name to "date" but property stays as "createdAt"
});

export const insertOrderSchema = createInsertSchema(orders, {
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "upi", "bank_transfer", "store_credit", "mixed"]),
  subTotal: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  discountPercentage: z.string().optional().transform(val => {
    if (val === "" || val === null || val === undefined) return null;
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error("Discount percentage must be a number between 0 and 100");
    }
    // Allow decimal percentages (no rounding/truncation)
    return num.toString();
  }).nullable(),
  discountAmount: z.string().optional().transform(val => {
    if (val === "" || val === null || val === undefined) return null;
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      throw new Error("Discount amount must be a positive number");
    }
    // Truncate decimal portion (convert paise to rupees)
    return Math.floor(num).toString();
  }).nullable(),
  totalAmount: z.string().min(1, "Total amount is required"),
}).omit({ id: true, date: true, orderNumber: true });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

/* ---------------------- ORDER ITEMS TABLE ---------------------- */
export const orderItems = pgTable("order_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 }).notNull(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
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
  payments?: PaymentDetail[];
};

/* ---------------------- STOCK MOVEMENTS ---------------------- */
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull(),
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
export const stockStats = pgTable("stock_stats", {
  id: varchar("id", { length: 36 }).primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  available: integer("available").default(0).notNull(),
  sold: integer("sold").default(0).notNull(),
  returned: integer("returned").default(0).notNull(),
  purchased: integer("purchased").default(0).notNull(),
  initialStock: integer("initial_stock").default(0).notNull(),
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
export const returns = pgTable("returns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnNumber: varchar("return_number", { length: 50 }).notNull(),
  orderId: varchar("order_id", { length: 36 }).notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  customerEmail: varchar("customer_email", { length: 150 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash").notNull(),
  notes: text("notes"),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
  creditAmount: numeric("credit_amount", { precision: 10, scale: 2 }),
  exchangeValue: numeric("exchange_value", { precision: 10, scale: 2 }),
  additionalPayment: numeric("additional_payment", { precision: 10, scale: 2 }),
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
export const returnItems = pgTable("return_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  exchangeProductId: varchar("exchange_product_id", { length: 36 }),
  exchangeProductName: varchar("exchange_product_name", { length: 255 }),
});

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

/* ---------------------- PAYMENT DETAILS ---------------------- */
export const paymentDetails = pgTable("payment_details", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").default(sql`CURRENT_TIMESTAMP`),
  transactionId: varchar("transaction_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("completed").notNull(),
  notes: text("notes"),
});

export const insertPaymentDetailSchema = createInsertSchema(paymentDetails, {
  orderId: z.string().min(1, "Order ID is required"),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "upi", "bank_transfer", "store_credit"]),
  amount: z.string().min(1, "Amount is required"),
  status: z.enum(["pending", "completed", "failed", "refunded"]),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
}).omit({ 
  id: true, 
  paymentDate: true 
});

export type InsertPaymentDetail = z.infer<typeof insertPaymentDetailSchema>;
export type PaymentDetail = typeof paymentDetails.$inferSelect;

export type OrderWithPayments = Order & {
  items: OrderItem[];
  payments: PaymentDetail[];
};

/* ---------------------- DISCOUNT CODES ---------------------- */
export const discountCodes = pgTable("discount_codes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  customerEmail: varchar("customer_email", { length: 150 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes, {
  code: z.string().min(1, "Code is required"),
  customerEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  amount: z.string().min(1, "Amount is required").transform(val => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      throw new Error("Discount amount must be a positive number");
    }
    return val;
  }),
  expiresAt: z.date().optional(),
}).omit({ id: true, createdAt: true, isUsed: true, usedAt: true });

export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

/* ---------------------- ACCOUNTS (P&L) TABLE ---------------------- */
export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'sale', 'purchase', 'return', 'refund', 'adjustment'
  referenceId: varchar("reference_id", { length: 36 }), // order_id, return_id, etc.
  referenceNumber: varchar("reference_number", { length: 50 }), // order number, return number, etc.
  
  // Financial details
  revenue: numeric("revenue", { precision: 10, scale: 2 }).default("0.00").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  profit: numeric("profit", { precision: 10, scale: 2 }).default("0.00").notNull(),
  
  // Additional breakdowns
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).default("0.00"),
  
  // Product/Category info
  productId: varchar("product_id", { length: 36 }),
  productName: varchar("product_name", { length: 255 }),
  category: varchar("category", { length: 100 }),
  quantity: integer("quantity").default(0),
  
  // Customer info
  customerName: varchar("customer_name", { length: 100 }),
  customerEmail: varchar("customer_email", { length: 150 }),
  
  // Metadata
  notes: text("notes"),
  fiscalYear: integer("fiscal_year"), // e.g., 2024
  fiscalMonth: integer("fiscal_month"), // 1-12
  fiscalQuarter: integer("fiscal_quarter"), // 1-4
  
  transactionDate: timestamp("transaction_date").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

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
