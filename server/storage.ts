import {
  products,
  orders,
  orderItems,
  stockMovements,
  stockStats,
  returns,
  returnItems,
  discountCodes,
  accounts,
  paymentDetails,
} from "@shared/schema.mysql";
import type {
  InsertProduct,
  Product,
  InsertOrder,
  Order,
  InsertOrderItem,
  OrderItem,
  OrderWithItems,
  StockMovement,
  InsertStockMovement,
  StockStats,
  InsertStockStats,
  Return,
  InsertReturn,
  ReturnItem,
  InsertReturnItem,
  ReturnWithItems,
  DiscountCode,
  InsertDiscountCode,
  PaymentDetail,
  InsertPaymentDetail,
} from "@shared/schema.mysql";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";


export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySKU(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Orders
  getOrders(): Promise<OrderWithItems[]>;
  getOrder(id: string): Promise<OrderWithItems | undefined>;
  getOrdersByCustomerEmail(email: string): Promise<OrderWithItems[]>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithItems>;
  updateOrder(id: string, order: InsertOrder): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;

  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;

  // Stock Movements
  getStockMovements(productId?: string): Promise<StockMovement[]>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;
  getLowStockProducts(threshold?: number): Promise<Product[]>;

  // Stock Stats
  getStockStats(): Promise<StockStats[]>;
  getStockStatsByProduct(productId: string): Promise<StockStats | null>;
  updateStockStats(productId: string, updates: Partial<StockStats>): Promise<StockStats | null>;
  initializeStockStats(product: Product): Promise<StockStats>;

  // Returns
  getReturns(): Promise<ReturnWithItems[]>;
  getReturn(id: string): Promise<ReturnWithItems | null>;
  createReturn(data: InsertReturn, items: InsertReturnItem[]): Promise<ReturnWithItems>;
  updateReturn(id: string, data: Partial<InsertReturn>): Promise<Return | null>;

  // Discount Codes
  getDiscountCodes(customerEmail?: string): Promise<DiscountCode[]>;
  getDiscountCode(code: string): Promise<DiscountCode | null>;
  createDiscountCode(data: InsertDiscountCode): Promise<DiscountCode>;
  useDiscountCode(code: string, amountUsed: string): Promise<{ updated: DiscountCode | null; wasDeleted: boolean; wasFound: boolean; error?: string }>;
  deleteDiscountCode(id: string): Promise<boolean>;

  // Payment Details
  getPaymentDetails(orderId: string): Promise<PaymentDetail[]>;
  createPaymentDetail(payment: InsertPaymentDetail): Promise<PaymentDetail>;
  updatePaymentDetail(id: string, payment: Partial<InsertPaymentDetail>): Promise<PaymentDetail | null>;
  deletePaymentDetail(id: string): Promise<boolean>;
  getPaymentsByOrder(orderId: string): Promise<PaymentDetail[]>;
  getTotalPaidForOrder(orderId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Products
  async getProducts(): Promise<Product[]> {
    const results = await db.select().from(products);
    return results.map(product => ({
      ...product,
      galleryImages: product.galleryImages ? JSON.parse(product.galleryImages) : [],
      tags: product.tags ? JSON.parse(product.tags) : [],
    }));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    if (result.length === 0) return undefined;
    return {
      ...result[0],
      galleryImages: result[0].galleryImages ? JSON.parse(result[0].galleryImages) : [],
      tags: result[0].tags ? JSON.parse(result[0].tags) : [],
    };
  }

  async getProductBySKU(sku: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.sku, sku));
    if (result.length === 0) return undefined;
    return {
      ...result[0],
      galleryImages: result[0].galleryImages ? JSON.parse(result[0].galleryImages) : [],
      tags: result[0].tags ? JSON.parse(result[0].tags) : [],
    };
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();

    const productData: any = {
      id,
      galleryImages: insertProduct.galleryImages ? JSON.stringify(insertProduct.galleryImages) : null,
      tags: insertProduct.tags ? JSON.stringify(insertProduct.tags) : null,
    };

    Object.keys(insertProduct).forEach(key => {
      const value = (insertProduct as any)[key];
      if (value !== undefined && key !== 'galleryImages' && key !== 'tags') {
        productData[key] = value;
      }
    });

    console.log('Product data to insert:', JSON.stringify(productData, null, 2));

    await db.insert(products).values(productData);

    const productResult = await db.select().from(products).where(eq(products.id, id));
    const product = productResult[0];

    await this.initializeStockStats(product);

    if (product.stockQuantity > 0) {
      await db.insert(stockMovements).values({
        id: randomUUID(),
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        type: "in",
        quantity: product.stockQuantity,
        reason: "Initial Stock",
        notes: "Initial stock added during product creation",
      });
    }

    return {
      ...product,
      galleryImages: product.galleryImages ? JSON.parse(product.galleryImages) : [],
      tags: product.tags ? JSON.parse(product.tags) : [],
    };
  }

  async updateProduct(id: string, product: InsertProduct): Promise<Product | undefined> {
    const productData: any = {
      galleryImages: product.galleryImages ? JSON.stringify(product.galleryImages) : null,
      tags: product.tags ? JSON.stringify(product.tags) : null,
    };

    Object.keys(product).forEach(key => {
      const value = (product as any)[key];
      if (value !== undefined && key !== 'galleryImages' && key !== 'tags') {
        productData[key] = value;
      }
    });

    await db.update(products)
      .set(productData)
      .where(eq(products.id, id));

    const result = await db.select().from(products).where(eq(products.id, id));
    if (result.length === 0) return undefined;
    return {
      ...result[0],
      galleryImages: result[0].galleryImages ? JSON.parse(result[0].galleryImages) : [],
      tags: result[0].tags ? JSON.parse(result[0].tags) : [],
    };
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      await db.delete(stockStats).where(eq(stockStats.productId, id));
      await db.delete(products).where(eq(products.id, id));
      return true;
    } catch (error: any) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Orders
  async getOrders(): Promise<OrderWithItems[]> {
    const allOrders = await db.select().from(orders);
    return await Promise.all(
      allOrders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        const payments = await this.getPaymentsByOrder(order.id);
        return { ...order, items, payments };
      })
    );
  }

  async getOrder(id: string): Promise<OrderWithItems | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    if (result.length === 0) return undefined;

    const items = await this.getOrderItems(id);
    const payments = await this.getPaymentsByOrder(id);
    return { ...result[0], items, payments };
  }

  async getOrdersByCustomerEmail(email: string): Promise<OrderWithItems[]> {
    const result = await db.select().from(orders).where(eq(orders.customerEmail, email));
    return await Promise.all(
      result.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        const payments = await this.getPaymentsByOrder(order.id);
        return { ...order, items, payments };
      })
    );
  }

  async createOrder(orderData: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithItems> {
    const id = randomUUID();
    const orderNumber = `ORD-${Date.now()}`;

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    
    // Handle discount calculation
    let finalTotal = subtotal;
    let discountAmount = 0;
    let discountPercentage = 0;
    
    // Apply discount based on the provided values
    if (orderData.discountPercentage !== undefined && orderData.discountPercentage !== null && orderData.discountPercentage !== '') {
      discountPercentage = parseFloat(orderData.discountPercentage);
      discountAmount = (subtotal * discountPercentage) / 100;
      finalTotal = subtotal - discountAmount;
    } else if (orderData.discountAmount !== undefined && orderData.discountAmount !== null && orderData.discountAmount !== '') {
      discountAmount = parseFloat(orderData.discountAmount);
      finalTotal = subtotal - discountAmount;
      discountPercentage = (discountAmount / subtotal) * 100;
    } else if (orderData.totalAmount !== undefined && parseFloat(orderData.totalAmount) < subtotal) {
      // If totalAmount is provided and less than subtotal, calculate discount from it
      finalTotal = parseFloat(orderData.totalAmount);
      discountAmount = subtotal - finalTotal;
      discountPercentage = (discountAmount / subtotal) * 100;
    } else {
      // If no discount is applied, set total to subtotal
      finalTotal = subtotal;
    }
    
    // Ensure finalTotal is not negative
    finalTotal = Math.max(0, finalTotal);

    await db.insert(orders).values({
      ...orderData,
      id,
      orderNumber,
      subTotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      discountPercentage: discountPercentage.toFixed(2),
      totalAmount: finalTotal.toFixed(2),
    });

    const orderResult = await db.select().from(orders).where(eq(orders.id, id));
    const order = orderResult[0];

    const createdItems = [];
    for (const item of items) {
      const itemId = randomUUID();
      await db.insert(orderItems).values({
        ...item,
        id: itemId,
        orderId: id,
      });

      const orderItemResult = await db.select().from(orderItems).where(eq(orderItems.id, itemId));
      createdItems.push(orderItemResult[0]);

      const product = await this.getProduct(item.productId);
      if (product) {
        const newStockQuantity = product.stockQuantity - item.quantity;
        await db.update(products)
          .set({ stockQuantity: newStockQuantity })
          .where(eq(products.id, item.productId));

        await this.createStockMovement({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'out',
          quantity: item.quantity,
          reason: 'sale',
          notes: `Order ${orderNumber}`,
        });

        const stats = await this.getStockStatsByProduct(item.productId);
        if (stats) {
          await this.updateStockStats(item.productId, {
            available: Math.max(0, newStockQuantity),
            sold: stats.sold + item.quantity,
          });
        }
      }
    }

    return { ...order, items: createdItems };
  }

  async updateOrder(id: string, insertOrder: InsertOrder): Promise<Order | undefined> {
    await db.update(orders)
      .set(insertOrder)
      .where(eq(orders.id, id));

    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
    return true;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // Stock Movements
  async getStockMovements(productId?: string): Promise<StockMovement[]> {
    if (productId) {
      return await db.select().from(stockMovements).where(eq(stockMovements.productId, productId));
    }
    return await db.select().from(stockMovements);
  }

  async createStockMovement(insertMovement: InsertStockMovement): Promise<StockMovement> {
    const id = randomUUID();
    await db.insert(stockMovements).values({
      ...insertMovement,
      id,
    });

    const movementResult = await db.select().from(stockMovements).where(eq(stockMovements.id, id));
    const movement = movementResult[0];

    // Use atomic update to avoid race conditions
    if (insertMovement.type === "in") {
      await db.update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} + ${insertMovement.quantity}`,
        })
        .where(eq(products.id, insertMovement.productId));
    } else if (insertMovement.type === "out") {
      await db.update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${insertMovement.quantity}`,
        })
        .where(eq(products.id, insertMovement.productId));
    } else if (insertMovement.type === "adjustment") {
      await db.update(products)
        .set({
          stockQuantity: insertMovement.quantity,
        })
        .where(eq(products.id, insertMovement.productId));
    }

    // Get updated product after atomic update
    const updatedProduct = await this.getProduct(insertMovement.productId);
    if (updatedProduct) {
      const finalQuantity = Math.max(0, updatedProduct.stockQuantity);
      
      const stats = await this.getStockStatsByProduct(insertMovement.productId);
      if (stats) {
        if (insertMovement.reason === 'purchase') {
          await this.updateStockStats(insertMovement.productId, {
            available: finalQuantity,
            purchased: stats.purchased + insertMovement.quantity,
          });
        } else {
          await this.updateStockStats(insertMovement.productId, {
            available: finalQuantity,
          });
        }
      }
    }

    return movement;
  }

  async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    try {
      const lowStockProducts = await db.select().from(products).where(sql`${products.stockQuantity} < ${threshold} AND ${products.stockQuantity} > 0`);
      return lowStockProducts.map(product => ({
        ...product,
        galleryImages: product.galleryImages ? JSON.parse(product.galleryImages) : [],
        tags: product.tags ? JSON.parse(product.tags) : [],
      }));
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      return [];
    }
  }

  // Returns
  async getReturns(): Promise<ReturnWithItems[]> {
    const allReturns = await db.select().from(returns);
    return await Promise.all(
      allReturns.map(async (ret) => {
        const items = await db.select().from(returnItems).where(eq(returnItems.returnId, ret.id));
        return { ...ret, items };
      })
    );
  }

  async getReturn(id: string): Promise<ReturnWithItems | null> {
    const result = await db.select().from(returns).where(eq(returns.id, id));
    if (result.length === 0) return null;

    const items = await db.select().from(returnItems).where(eq(returnItems.returnId, id));
    return { ...result[0], items };
  }

  async createReturn(data: InsertReturn, items: InsertReturnItem[]): Promise<ReturnWithItems> {
    const returnId = randomUUID();
    const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    console.log('Database: Creating return with values:', {
      returnId,
      returnNumber,
      creditAmount: data.creditAmount,
      refundAmount: data.refundAmount,
      customerEmail: data.customerEmail
    });

    await db.insert(returns).values({
      id: returnId,
      returnNumber,
      ...data,
    });

    const returnResult = await db.select().from(returns).where(eq(returns.id, returnId));
    const newReturn = returnResult[0];

    console.log('Database: Return created in DB:', {
      id: newReturn.id,
      creditAmount: newReturn.creditAmount,
      refundAmount: newReturn.refundAmount
    });

    const createdItems: ReturnItem[] = [];
    for (const item of items) {
      const itemId = randomUUID();
      await db.insert(returnItems).values({
        id: itemId,
        returnId,
        ...item,
      });

      const returnItemResult = await db.select().from(returnItems).where(eq(returnItems.id, itemId));
      createdItems.push(returnItemResult[0]);

      const product = await this.getProduct(item.productId);
      if (product) {
        const newStockQuantity = product.stockQuantity + item.quantity;
        await db.update(products)
          .set({ stockQuantity: newStockQuantity })
          .where(eq(products.id, item.productId));

        const stats = await this.getStockStatsByProduct(item.productId);
        if (stats) {
          await this.updateStockStats(item.productId, {
            available: product.stockQuantity + item.quantity,
            returned: stats.returned + item.quantity,
          });
        }
      }

      await this.createStockMovement({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        type: 'in',
        quantity: item.quantity,
        reason: 'return',
        notes: `Return ${returnNumber}`,
      });
    }

    return { ...newReturn, items: createdItems };
  }

  async updateReturn(id: string, data: Partial<InsertReturn>): Promise<Return | null> {
    await db.update(returns)
      .set(data)
      .where(eq(returns.id, id));

    const result = await db.select().from(returns).where(eq(returns.id, id));
    return result[0] || null;
  }

  // Discount codes
  async getDiscountCodes(customerEmail?: string): Promise<DiscountCode[]> {
    if (customerEmail) {
      return await db.select().from(discountCodes).where(eq(discountCodes.customerEmail, customerEmail));
    }
    return await db.select().from(discountCodes);
  }

  async getDiscountCode(code: string): Promise<DiscountCode | null> {
    const result = await db.select().from(discountCodes).where(eq(discountCodes.code, code));
    return result[0] || null;
  }

  async createDiscountCode(data: InsertDiscountCode): Promise<DiscountCode> {
    const id = randomUUID();
    const amount = typeof data.amount === 'string' ? data.amount : String(data.amount);

    console.log('Database: Inserting discount code:', {
      id,
      code: data.code,
      customerEmail: data.customerEmail,
      amount,
      expiresAt: data.expiresAt
    });

    await db.insert(discountCodes).values({
      ...data,
      id,
      amount,
      isUsed: false,
      usedAt: null,
    });

    const discountCodeResult = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    const discountCode = discountCodeResult[0];

    if (!discountCode) {
      throw new Error('Failed to retrieve created discount code');
    }

    console.log('Database: Created discount code successfully', {
      id: discountCode.id,
      code: discountCode.code,
      amount: discountCode.amount,
      customerEmail: discountCode.customerEmail
    });
    return discountCode;
  }

  async useDiscountCode(code: string, amountUsed: string): Promise<{ updated: DiscountCode | null; wasDeleted: boolean; wasFound: boolean; error?: string }> {
    const discountCode = await this.getDiscountCode(code);
    if (!discountCode) {
      console.log('Database: Discount code not found:', code);
      return { updated: null, wasDeleted: false, wasFound: false };
    }

    const currentAmount = parseFloat(discountCode.amount);
    const usedAmount = parseFloat(amountUsed);

    console.log('Database: Using discount code', { code, currentAmount, usedAmount });

    if (isNaN(usedAmount) || usedAmount <= 0) {
      return {
        updated: null,
        wasDeleted: false,
        wasFound: true,
        error: "Amount used must be a positive number"
      };
    }

    if (usedAmount > currentAmount) {
      return {
        updated: null,
        wasDeleted: false,
        wasFound: true,
        error: `Amount used ($${usedAmount.toFixed(2)}) exceeds available credit ($${currentAmount.toFixed(2)})`
      };
    }

    const remainingAmount = currentAmount - usedAmount;

    if (remainingAmount <= 0.01) {
      await db.delete(discountCodes).where(eq(discountCodes.id, discountCode.id));
      console.log('Database: Discount code fully used and deleted:', code);
      return { updated: null, wasDeleted: true, wasFound: true };
    }

    await db.update(discountCodes)
      .set({ amount: remainingAmount.toFixed(2) })
      .where(eq(discountCodes.id, discountCode.id));

    const updatedResult = await db.select().from(discountCodes).where(eq(discountCodes.id, discountCode.id));
    const updated = updatedResult[0];
    console.log('Database: Discount code updated with remaining amount:', remainingAmount.toFixed(2));
    return { updated, wasDeleted: false, wasFound: true };
  }

  async deleteDiscountCode(id: string): Promise<boolean> {
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
    return true;
  }

  // Stock Stats
  async getStockStats(): Promise<StockStats[]> {
    const allProducts = await db.select().from(products);

    for (const product of allProducts) {
      const existing = await db
        .select()
        .from(stockStats)
        .where(eq(stockStats.productId, product.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(stockStats).values({
          id: nanoid(),
          productId: product.id,
          productName: product.productName,
          sku: product.sku,
          category: product.category,
          available: product.stockQuantity,
          sold: 0,
          returned: 0,
          purchased: 0,
        });
      } else {
        await db
          .update(stockStats)
          .set({
            available: product.stockQuantity,
            updatedAt: new Date()
          })
          .where(eq(stockStats.productId, product.id));
      }
    }

    const stats = await db.select().from(stockStats);
    return stats;
  }

  async getStockStatsByProduct(productId: string): Promise<StockStats | null> {
    const result = await db.select().from(stockStats).where(eq(stockStats.productId, productId));
    return result[0] || null;
  }

  async updateStockStats(productId: string, updates: Partial<StockStats>): Promise<StockStats | null> {
    await db.update(stockStats)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stockStats.productId, productId));

    const result = await db.select().from(stockStats).where(eq(stockStats.productId, productId));
    return result[0] || null;
  }

  async initializeStockStats(product: Product): Promise<StockStats> {
    const id = randomUUID();
    await db.insert(stockStats).values({
      id,
      productId: product.id,
      productName: product.productName,
      sku: product.sku,
      category: product.category,
      available: product.stockQuantity,
      sold: 0,
      returned: 0,
      purchased: 0,
    });

    const statsResult = await db.select().from(stockStats).where(eq(stockStats.id, id));
    return statsResult[0];
  }

  // Payment Details
  async getPaymentDetails(orderId: string): Promise<PaymentDetail[]> {
    return await db.select().from(paymentDetails).where(eq(paymentDetails.orderId, orderId));
  }

  async createPaymentDetail(payment: InsertPaymentDetail): Promise<PaymentDetail> {
    const id = randomUUID();
    await db.insert(paymentDetails).values({
      ...payment,
      id,
    });

    const paymentResult = await db.select().from(paymentDetails).where(eq(paymentDetails.id, id));
    return paymentResult[0];
  }

  async updatePaymentDetail(id: string, payment: Partial<InsertPaymentDetail>): Promise<PaymentDetail | null> {
    await db.update(paymentDetails)
      .set(payment)
      .where(eq(paymentDetails.id, id));

    const result = await db.select().from(paymentDetails).where(eq(paymentDetails.id, id));
    return result[0] || null;
  }

  async deletePaymentDetail(id: string): Promise<boolean> {
    await db.delete(paymentDetails).where(eq(paymentDetails.id, id));
    return true;
  }

  async getPaymentsByOrder(orderId: string): Promise<PaymentDetail[]> {
    return await db.select().from(paymentDetails).where(eq(paymentDetails.orderId, orderId));
  }

  async getTotalPaidForOrder(orderId: string): Promise<number> {
    const payments = await this.getPaymentsByOrder(orderId);
    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. Please set it in the Secrets tool.');
}

export const storage = new DatabaseStorage();