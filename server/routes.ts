import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { qrCodeService } from "./qr-service";
import {
  products,
  orders,
  orderItems,
  returns,
  returnItems,
  stockMovements,
  stockStats,
  discountCodes,
  accounts,
  paymentDetails,
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertReturnSchema,
  insertReturnItemSchema,
  insertStockMovementSchema,
  insertDiscountCodeSchema,
  insertPaymentDetailSchema,
} from "@shared/schema.mysql";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { nanoid } from "nanoid";
import { log } from "./log";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { emailService } from "./email-service";

// Extend global namespace for temporary file storage
declare global {
  var tempFiles: Record<string, { buffer: Buffer; fileName: string; mimeType: string }> | undefined;
}

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // QR Code generation endpoint
  app.post("/api/qr-code/generate", async (req, res) => {
    try {
      const { data } = req.body;
      if (!data || typeof data !== "string") {
        return res.status(400).json({ error: "Data parameter is required" });
      }

      const qrCodeDataURL = await qrCodeService.generateQRCode(data);
      res.json({ qrCode: qrCodeDataURL });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // Get QR code as image
  app.get("/api/qr-code/:data", async (req, res) => {
    try {
      const data = decodeURIComponent(req.params.data);
      const buffer = await qrCodeService.generateQRCodeBuffer(data);
      res.setHeader("Content-Type", "image/png");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // Image upload endpoint
  app.post("/api/upload/image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Convert buffer to base64 data URL
      const base64 = req.file.buffer.toString("base64");
      const dataURL = `data:${req.file.mimetype};base64,${base64}`;

      res.json({ url: dataURL });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Multiple image upload endpoint
  app.post("/api/upload/images", upload.array("images", 5), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No image files provided" });
      }

      const urls = req.files.map((file) => {
        const base64 = file.buffer.toString("base64");
        return `data:${file.mimetype};base64,${base64}`;
      });

      res.json({ urls });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload images" });
    }
  });
  // Product routes
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      // Log the incoming request data
      console.log('Creating product with data:', JSON.stringify(req.body, null, 2));
      
      const parsed = insertProductSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        console.error('Validation error:', error.message);
        return res.status(400).json({ error: error.message });
      }

      console.log('Parsed product data:', JSON.stringify(parsed.data, null, 2));

      // Check if SKU already exists
      const existing = await storage.getProductBySKU(parsed.data.sku);
      if (existing) {
        return res.status(400).json({ error: "Product with this SKU already exists" });
      }

      const product = await storage.createProduct(parsed.data);

      // Create initial stock movement
      if (parsed.data.stockQuantity > 0) {
        await storage.createStockMovement({
          productId: product.id,
          productName: product.productName,
          sku: product.sku,
          type: "in",
          quantity: parsed.data.stockQuantity,
          reason: "Initial Stock",
          notes: "Initial stock when product was created",
        });
      }

      // Record purchase profit/loss in accounts table
      if (parsed.data.costPrice && parsed.data.stockQuantity > 0) {
        const sellingPrice = parseFloat(parsed.data.price.toString());
        const costPrice = parseFloat(parsed.data.costPrice.toString());
        const quantity = parsed.data.stockQuantity;

        const difference = sellingPrice - costPrice;
        const totalDifference = difference * quantity;

        const currentDate = new Date();
        const fiscalYear = currentDate.getFullYear();
        const fiscalMonth = currentDate.getMonth() + 1;
        const fiscalQuarter = Math.ceil(fiscalMonth / 3);

        if (difference > 0) {
          // Potential profit (selling price > cost price)
          await db.insert(accounts).values({
            id: nanoid(),
            transactionType: "purchase",
            referenceId: product.id,
            referenceNumber: product.sku,
            revenue: "0.00",
            cost: (costPrice * quantity).toFixed(2),
            profit: totalDifference.toFixed(2),
            productId: product.id,
            productName: product.productName,
            category: product.category,
            quantity: quantity,
            notes: `Purchase with potential profit of $${difference.toFixed(2)} per unit`,
            fiscalYear,
            fiscalMonth,
            fiscalQuarter,
          });
        } else if (difference < 0) {
          // Potential loss (selling price < cost price)
          await db.insert(accounts).values({
            id: nanoid(),
            transactionType: "purchase",
            referenceId: product.id,
            referenceNumber: product.sku,
            revenue: "0.00",
            cost: (costPrice * quantity).toFixed(2),
            profit: totalDifference.toFixed(2), // This will be negative
            productId: product.id,
            productName: product.productName,
            category: product.category,
            quantity: quantity,
            notes: `Purchase with potential loss of $${Math.abs(difference).toFixed(2)} per unit`,
            fiscalYear,
            fiscalMonth,
            fiscalQuarter,
          });
        }
      }

      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const parsed = insertProductSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      // Check if SKU already exists for another product
      const existing = await storage.getProductBySKU(parsed.data.sku);
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ error: "Product with this SKU already exists" });
      }

      const product = await storage.updateProduct(req.params.id, parsed.data);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const success = await storage.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      const errorMessage = error.message || "Failed to delete product";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Order routes
  app.get("/api/orders", async (_req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: `Failed to fetch orders: ${error.message || 'Unknown error'}` });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      console.error('Error fetching order:', error);
      res.status(500).json({ error: `Failed to fetch order: ${error.message || 'Unknown error'}` });
    }
  });

  app.get("/api/orders/customer/:email", async (req, res) => {
    try {
      const orders = await storage.getOrdersByCustomerEmail(req.params.email);
      res.json(orders);
    } catch (error: any) {
      console.error('Error fetching orders by customer email:', error);
      res.status(500).json({ error: `Failed to fetch orders: ${error.message || 'Unknown error'}` });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { items, ...orderData } = req.body;

      console.log("DEBUG: Order data received at server:", {
        orderData,
        items,
        paymentMethod: orderData.paymentMethod
      });

      const parsedOrder = insertOrderSchema.safeParse(orderData);
      if (!parsedOrder.success) {
        const error = fromZodError(parsedOrder.error);
        console.error('Order validation error:', error.message);
        return res.status(400).json({ error: error.message });
      }

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Order must have at least one item" });
      }

      const orderItemsSchema = z.array(insertOrderItemSchema);
      const parsedItems = orderItemsSchema.safeParse(items);
      if (!parsedItems.success) {
        const error = fromZodError(parsedItems.error);
        console.error('Order items validation error:', error.message);
        return res.status(400).json({ error: error.message });
      }

      console.log("DEBUG: Parsed order data before DB insert:", {
        parsedOrderData: parsedOrder.data,
        paymentMethod: parsedOrder.data.paymentMethod
      });

      const order = await storage.createOrder(parsedOrder.data, parsedItems.data);
      res.status(201).json(order);
    } catch (error: any) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: `Failed to create order: ${error.message || 'Unknown error'}` });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const parsed = insertOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const order = await storage.updateOrder(req.params.id, parsed.data);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const success = await storage.deleteOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Stock Movement routes
  app.get("/api/stock-movements", async (req, res) => {
    try {
      const productId = req.query.productId as string | undefined;
      const movements = await storage.getStockMovements(productId);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock movements" });
    }
  });

  app.post("/api/stock-movements", async (req, res) => {
    try {
      const parsed = insertStockMovementSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const movement = await storage.createStockMovement(parsed.data);
      res.status(201).json(movement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stock movement" });
    }
  });

  app.get("/api/stock-movements/low-stock", async (req, res) => {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 10;
      const products = await storage.getLowStockProducts(threshold);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });

  // Stock stats routes
  app.get("/api/stock-stats", async (_req, res) => {
    try {
      const stats = await storage.getStockStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock stats" });
    }
  });

  app.get("/api/stock-stats/:productId", async (req, res) => {
    try {
      const stats = await storage.getStockStatsByProduct(req.params.productId);
      if (!stats) {
        return res.status(404).json({ error: "Stock stats not found" });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock stats" });
    }
  });

  // Return routes
  app.get("/api/returns", async (_req, res) => {
    try {
      const returns = await storage.getReturns();
      res.json(returns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch returns" });
    }
  });

  app.get("/api/returns/:id", async (req, res) => {
    try {
      const ret = await storage.getReturn(req.params.id);
      if (!ret) {
        return res.status(404).json({ error: "Return not found" });
      }
      res.json(ret);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch return" });
    }
  });

  app.post("/api/returns", async (req, res) => {
    try {
      const { items, ...returnData } = req.body;

      console.log('Creating return with data:', {
        creditAmount: returnData.creditAmount,
        refundAmount: returnData.refundAmount,
        exchangeValue: returnData.exchangeValue,
        additionalPayment: returnData.additionalPayment,
        customerEmail: returnData.customerEmail,
        itemsCount: items?.length
      });

      const newReturn = await storage.createReturn(returnData, items);

      // Create discount code if there's a credit amount (return value > exchange value)
      // Parse credit amount - it can be null, undefined, or a string
      const creditAmount = returnData.creditAmount && returnData.creditAmount !== "0" && returnData.creditAmount !== ""
        ? parseFloat(returnData.creditAmount)
        : 0;

      console.log('Checking store credit creation:', {
        rawCreditAmount: returnData.creditAmount,
        parsedCreditAmount: creditAmount,
        hasEmail: !!returnData.customerEmail,
        shouldCreate: creditAmount > 0 && returnData.customerEmail
      });

      if (creditAmount > 0) {
        const code = `CREDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiry

        console.log('Creating discount code for store credit:', {
          code,
          amount: creditAmount.toFixed(2),
          email: returnData.customerEmail,
          creditAmountType: typeof creditAmount,
          creditAmountValue: creditAmount
        });

        try {
          const discountCode = await storage.createDiscountCode({
            code,
            customerEmail: returnData.customerEmail,
            amount: creditAmount.toFixed(2),
            expiresAt,
          });

          console.log('Discount code created successfully:', {
            id: discountCode.id,
            code: discountCode.code,
            amount: discountCode.amount
          });

          // Send email notification
          try {
            await emailService.sendDiscountCode(
              returnData.customerEmail,
              code,
              creditAmount.toFixed(2),
              expiresAt
            );
            console.log('Email notification sent successfully');
          } catch (emailError) {
            console.error('Failed to send discount code email:', emailError);
          }
        } catch (discountError: any) {
          console.error('Failed to create discount code:', discountError);
          console.error('Discount code error details:', {
            message: discountError.message,
            stack: discountError.stack,
            code: discountError.code,
            name: discountError.name
          });
          // Send error response to frontend
          return res.status(500).json({ 
            message: 'Return created successfully, but failed to create store credit', 
            error: discountError.message,
            returnId: newReturn.id
          });
        }
      } else {
        console.log('Skipping discount code creation:', {
          creditAmount,
          hasEmail: !!returnData.customerEmail,
          reason: creditAmount <= 0 ? 'No credit amount' : 'No customer email'
        });
      }

      // Log payable account if exchange value > return value
      if (returnData.additionalPayment && parseFloat(returnData.additionalPayment) > 0) {
        console.log('Payable account created:', {
          customerEmail: returnData.customerEmail,
          amount: returnData.additionalPayment,
          returnNumber: newReturn.returnNumber
        });
      }

      res.json(newReturn);
    } catch (error: any) {
      console.error('Error creating return:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/returns/:id", async (req, res) => {
    try {
      const parsed = insertReturnSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const ret = await storage.updateReturn(req.params.id, parsed.data);
      if (!ret) {
        return res.status(404).json({ error: "Return not found" });
      }
      res.json(ret);
    } catch (error) {
      res.status(500).json({ error: "Failed to update return" });
    }
  });

  // Discount code routes
  app.get("/api/discount-codes", async (req, res) => {
    try {
      const customerEmail = req.query.customerEmail as string | undefined;
      const codes = await storage.getDiscountCodes(customerEmail);
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount codes" });
    }
  });

  app.get("/api/discount-codes/:code", async (req, res) => {
    try {
      const code = await storage.getDiscountCode(req.params.code);
      if (!code) {
        return res.status(404).json({ error: "Discount code not found" });
      }
      res.json(code);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount code" });
    }
  });

  app.post("/api/discount-codes/:code/use", async (req, res) => {
    try {
      const schema = z.object({
        amountUsed: z.string().refine((val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        }, { message: "Amount used must be a positive number" }),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const result = await storage.useDiscountCode(req.params.code, parsed.data.amountUsed);

      if (!result.wasFound) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      if (result.wasDeleted) {
        res.json({ success: true, fullyUsed: true, remainingCredit: null });
      } else {
        res.json({ success: true, fullyUsed: false, remainingCredit: result.updated });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to use discount code" });
    }
  });

  app.delete("/api/discount-codes/:id", async (req, res) => {
    try {
      const success = await storage.deleteDiscountCode(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Discount code not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete discount code" });
    }
  });

  // Payment Details routes
  app.get("/api/payment-details", async (req, res) => {
    try {
      const orderId = req.query.orderId as string | undefined;
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }
      const payments = await storage.getPaymentDetails(orderId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment details" });
    }
  });

  app.get("/api/orders/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getPaymentsByOrder(req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments for order" });
    }
  });

  app.get("/api/orders/:id/total-paid", async (req, res) => {
    try {
      const total = await storage.getTotalPaidForOrder(req.params.id);
      res.json({ total });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate total paid for order" });
    }
  });

  app.post("/api/payment-details", async (req, res) => {
    try {
      const parsed = insertPaymentDetailSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const payment = await storage.createPaymentDetail(parsed.data);
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment detail" });
    }
  });

  // Accounts routes
  app.get("/api/accounts", async (_req, res) => {
    try {
      const accountsData = await db.select().from(accounts);
      res.json(accountsData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const accountData = {
        ...req.body,
        id: nanoid(),
      };
      
      await db.insert(accounts).values(accountData);
      const result = await db.select().from(accounts).where(eq(accounts.id, accountData.id));
      res.status(201).json(result[0]);
    } catch (error) {
      console.error("Error creating account entry:", error);
      res.status(500).json({ error: "Failed to create account entry" });
    }
  });

  // Invoice generation
  app.get("/api/orders/:id/invoice", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const {pdfService } = await import('./pdf-service');
      const pdfBuffer = await pdfService.generateInvoice(order);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Invoice generation error:', error);
      res.status(500).json({ error: "Failed to generate invoice" });
    }
  });

  // Return invoice generation
  app.get("/api/returns/:id/invoice", async (req, res) => {
    try {
      const returnData = await storage.getReturn(req.params.id);
      if (!returnData) {
        return res.status(404).json({ error: "Return not found" });
      }

      const order = await storage.getOrder(returnData.orderId);
      if (!order) {
        return res.status(404).json({ error: "Original order not found" });
      }

      const {pdfService } = await import('./pdf-service');
      const pdfBuffer = await pdfService.generateReturnInvoice(returnData, order);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="return-invoice-${returnData.returnNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Return invoice generation error:', error);
      res.status(500).json({ error: "Failed to generate return invoice" });
    }
  });

  // WhatsApp file send endpoint - generates downloadable invoice for WhatsApp Desktop
  app.post("/api/whatsapp/send-file", upload.single("file"), async (req, res) => {
    try {
      const { phoneNumber, message, orderId } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }
      
      // Generate the invoice
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const {pdfService } = await import('./pdf-service');
      const pdfBuffer = await pdfService.generateInvoice(order);
      const fileName = `invoice-${order.orderNumber}.pdf`;
      
      // Create a permanent download URL for the invoice
      // WhatsApp Desktop will be able to automatically detect this file
      const downloadUrl = `${req.protocol}://${req.get('host')}/api/whatsapp/download/${orderId}`;
      
      // Store the file in global temp storage for direct access
      const fileUrl = `/api/whatsapp/download/${orderId}`;
      global.tempFiles = global.tempFiles || {};
      global.tempFiles[fileUrl] = {
        buffer: pdfBuffer,
        fileName: fileName,
        mimeType: 'application/pdf'
      };
      
      // Prepare WhatsApp message in requested format
      const phoneNumberClean = phoneNumber.replace(/[^0-9]/g, '');
      const formattedTotal = Math.floor(parseFloat(order.totalAmount.toString())).toLocaleString('en-IN');
      const whatsappMessage = `Hello ${order.customerName},

Thanks for visiting Fabrix and shopping with us! 👕😊

Your invoice for order #${order.orderNumber} is attached here.
Total: ₹${formattedTotal}

📍 SUPER MALL-2, FF/152, Infocity, Gandhinagar, Gujarat 382007

Thanks again for your purchase—hope to see you again soon! 🙌`;
      const encodedMessage = encodeURIComponent(whatsappMessage);
      
      // Use WhatsApp Web URL scheme with file attachment parameter
      const whatsappUrl = `https://wa.me/${phoneNumberClean}?text=${encodedMessage}&file=${encodeURIComponent(downloadUrl)}`;
      
      res.json({
        success: true,
        whatsappUrl: whatsappUrl,
        downloadUrl: downloadUrl,
        fileName: fileName,
        orderNumber: order.orderNumber
      });
    } catch (error) {
      console.error('WhatsApp file send error:', error);
      res.status(500).json({ error: "Failed to send WhatsApp file" });
    }
  });

  // WhatsApp invoice download endpoint
  app.get("/api/whatsapp/download/:orderId", async (req, res) => {
    try {
      const fileUrl = `/api/whatsapp/download/${req.params.orderId}`;
      
      if (!global.tempFiles || !global.tempFiles[fileUrl]) {
        // Generate the invoice on-the-fly if not in cache
        const order = await storage.getOrder(req.params.orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        
        const {pdfService } = await import('./pdf-service');
        const pdfBuffer = await pdfService.generateInvoice(order);
        const fileName = `invoice-${order.orderNumber}.pdf`;
        
        global.tempFiles = global.tempFiles || {};
        global.tempFiles[fileUrl] = {
          buffer: pdfBuffer,
          fileName: fileName,
          mimeType: 'application/pdf'
        };
      }
      
      const fileData = global.tempFiles[fileUrl];
      
      // Set proper headers for file download
      res.setHeader('Content-Type', fileData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
      res.setHeader('Content-Length', fileData.buffer.length);
      
      res.send(fileData.buffer);
      
      // Optional: Clean up the temporary file after 5 minutes
      setTimeout(() => {
        if (global.tempFiles && global.tempFiles[fileUrl]) {
          delete global.tempFiles[fileUrl];
        }
      }, 5 * 60 * 1000); // 5 minutes
      
    } catch (error) {
      console.error('WhatsApp invoice download error:', error);
      res.status(500).json({ error: "Failed to download invoice" });
    }
  });

  // Temporary file download endpoint
  app.get("/api/temp-file/:fileName", async (req, res) => {
    try {
      const tempUrl = `/api/temp-file/${req.params.fileName}`;
      
      if (!global.tempFiles || !global.tempFiles[tempUrl]) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const fileData = global.tempFiles[tempUrl];
      
      res.setHeader('Content-Type', fileData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
      res.send(fileData.buffer);
      
      // Clean up the temporary file after sending
      delete global.tempFiles[tempUrl];
    } catch (error) {
      console.error('Temporary file download error:', error);
      res.status(500).json({ error: "Failed to download temporary file" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}