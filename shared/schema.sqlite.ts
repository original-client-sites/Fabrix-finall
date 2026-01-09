
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------------------- PRODUCTS TABLE ---------------------- */
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  description: text("description"),

  color: text("color").notNull(),
  size: text("size").notNull(),
  fabric: text("fabric"),
  pattern: text("pattern"),
  gender: text("gender"),

  price: real("price").notNull(),
  costPrice: real("cost_price"),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  warehouse: text("warehouse"),

  productImage: text("product_image"),
  galleryImages: text("gallery_images"),

  isFeatured: integer("is_featured", { mode: 'boolean' }).default(false),
  launchDate: integer("launch_date", { mode: 'timestamp' }),
  rating: text("rating"),
  tags: text("tags"),

  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const insertProductSchema = createInsertSchema(products, {
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().min(1, "Brand is required"),
  color: z.string().min(1, "Color is required"),
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
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  status: text("status").default("pending").notNull(),
  notes: text("notes"),
  totalAmount: real("total_amount").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

/* ---------------------- ORDER ITEMS TABLE ---------------------- */
export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
});

/* ---------------------- STOCK MOVEMENTS ---------------------- */
export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

/* ---------------------- STOCK STATS ---------------------- */
export const stockStats = sqliteTable("stock_stats", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull(),
  available: integer("available").default(0).notNull(),
  sold: integer("sold").default(0).notNull(),
  returned: integer("returned").default(0).notNull(),
  purchased: integer("purchased").default(0).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

/* ---------------------- RETURNS ---------------------- */
export const returns = sqliteTable("returns", {
  id: text("id").primaryKey(),
  returnNumber: text("return_number").notNull(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  status: text("status").default("pending").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  refundAmount: real("refund_amount"),
  creditAmount: real("credit_amount"),
  exchangeValue: real("exchange_value"),
  additionalPayment: real("additional_payment"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

/* ---------------------- RETURN ITEMS ---------------------- */
export const returnItems = sqliteTable("return_items", {
  id: text("id").primaryKey(),
  returnId: text("return_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
  exchangeProductId: text("exchange_product_id"),
  exchangeProductName: text("exchange_product_name"),
});

/* ---------------------- DISCOUNT CODES ---------------------- */
export const discountCodes = sqliteTable("discount_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  customerEmail: text("customer_email").notNull(),
  amount: real("amount").notNull(),
  isUsed: integer("is_used", { mode: 'boolean' }).default(false),
  usedAt: integer("used_at", { mode: 'timestamp' }),
  expiresAt: integer("expires_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

/* ---------------------- ACCOUNTS (P&L) TABLE ---------------------- */
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  transactionType: text("transaction_type").notNull(),
  referenceId: text("reference_id"),
  referenceNumber: text("reference_number"),
  
  revenue: real("revenue").default(0.00).notNull(),
  cost: real("cost").default(0.00).notNull(),
  profit: real("profit").default(0.00).notNull(),
  
  taxAmount: real("tax_amount").default(0.00),
  discountAmount: real("discount_amount").default(0.00),
  shippingCost: real("shipping_cost").default(0.00),
  
  productId: text("product_id"),
  productName: text("product_name"),
  category: text("category"),
  quantity: integer("quantity").default(0),
  
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  
  notes: text("notes"),
  fiscalYear: integer("fiscal_year"),
  fiscalMonth: integer("fiscal_month"),
  fiscalQuarter: integer("fiscal_quarter"),
  
  transactionDate: integer("transaction_date", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
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
