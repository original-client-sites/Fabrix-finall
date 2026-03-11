
import PDFDocument from 'pdfkit';
import type { OrderWithItems, ReturnWithItems } from '@shared/schema.mysql';

// Define PDFDocument type alias
type PDFDoc = InstanceType<typeof PDFDocument>;

export class PDFService {
  private addStoreHeader(doc: PDFDoc) {
    // Store name and logo placeholder
    doc.fontSize(24).font('Helvetica-Bold').text('FABRIX', { align: 'center' });
    doc.moveDown(0.3);
    
    // Store details
    doc.fontSize(10).font('Helvetica');
    doc.text('SUPER MALL-2, FF/152, Infocity, Gandhinagar, Gujarat 382007', { align: 'center' });
    doc.text('Phone: +91 99245 55721 | WhatsApp: +91 80003 55721', { align: 'center' });
    //doc.text('Email: store@example.com | Website: www.yourstore.com', { align: 'center' });
    //doc.text('GSTIN: 22AAAAA0000A1Z5', { align: 'center' });
    doc.moveDown(0.5);
    
    // Divider line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
  }

  private addCustomerInfo(doc: PDFDoc, customerName: string, customerEmail?: string | null, customerPhone?: string | null) {
    const startY = doc.y;
    
    doc.fontSize(12).font('Helvetica-Bold').text('BILL TO:', 50, startY);
    doc.fontSize(10).font('Helvetica');
    doc.text(customerName, 50, startY + 20);
    if (customerPhone) doc.text(`Phone: ${customerPhone}`, 50);
    if (customerEmail) doc.text(`Email: ${customerEmail}`, 50);
  }

  private addTermsAndConditions(doc: PDFDoc) {
    doc.moveDown(1.5);
    doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:', 50);
    doc.fontSize(8).font('Helvetica');
    doc.text('• Items can be exchanged within 7 days with original tags & bill.', 50);
    doc.text('• No cash refunds, only store credit or exchange.', 50);
    doc.text('• Sale items are non-returnable.', 50);
    doc.text('• Please check your items before leaving the store.', 50);
  }

  private addFooter(doc: PDFDoc) {
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Thank you for shopping with us!', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Visit us again soon!', { align: 'center' });
    doc.moveDown(0.5);
    //doc.fontSize(8).text('Follow us on Instagram & Facebook: @yourstore', { align: 'center' });
  }

  async generateReturnInvoice(returnData: ReturnWithItems, order: OrderWithItems): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Store header
        this.addStoreHeader(doc);

        // Invoice title
        doc.fontSize(20).font('Helvetica-Bold').text('RETURN/EXCHANGE INVOICE', { align: 'center' });
        doc.moveDown(0.5);

        // Invoice details (right aligned)
        const detailsStartY = doc.y;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Return No: ${returnData.returnNumber}`, 350, detailsStartY, { align: 'right' });
        doc.text(`Original Order: ${returnData.orderNumber}`, 350, detailsStartY + 15, { align: 'right' });
        doc.text(`Date: ${returnData.createdAt ? new Date(returnData.createdAt).toLocaleString('en-IN', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : ''}`, 350, detailsStartY + 30, { align: 'right' });

        // Customer details (left side)
        doc.y = detailsStartY;
        this.addCustomerInfo(doc, returnData.customerName, returnData.customerEmail || undefined);
        
        doc.moveDown(2);

        // Returned items table
        let tableTop = doc.y;
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Returned Items:', 50, tableTop);
        doc.moveDown(0.5);
        
        tableTop = doc.y;
        doc.fontSize(10);
        doc.text('Item', 50, tableTop);
        doc.text('SKU', 200, tableTop);
        doc.text('Qty', 320, tableTop);
        doc.text('Price', 380, tableTop);
        doc.text('Total', 480, tableTop, { align: 'right' });
        
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        doc.font('Helvetica');
        let yPosition = tableTop + 25;
        
        let totalReturnValue = 0;
        returnData.items.forEach((item) => {
          doc.text(item.productName, 50, yPosition, { width: 140 });
          doc.text(item.sku, 200, yPosition);
          doc.text(item.quantity.toString(), 320, yPosition);
          doc.text(`inr ${item.unitPrice}`, 380, yPosition);
          doc.text(`inr ${item.subtotal}`, 480, yPosition, { align: 'right' });
          totalReturnValue += parseFloat(item.subtotal);
          yPosition += 25;
        });

        // Exchange items if any
        const exchangeItems = returnData.items.filter(item => item.exchangeProductId);
        if (exchangeItems.length > 0) {
          yPosition += 10;
          doc.fontSize(12).font('Helvetica-Bold');
          doc.text('Exchange Items:', 50, yPosition);
          doc.moveDown(0.5);
          
          yPosition = doc.y;
          doc.fontSize(10);
          doc.text('Item', 50, yPosition);
          doc.text('Qty', 320, yPosition);
          doc.text('Price', 380, yPosition);
          doc.text('Total', 480, yPosition, { align: 'right' });
          
          doc.moveTo(50, yPosition + 15).lineTo(550, yPosition + 15).stroke();
          
          doc.font('Helvetica');
          yPosition += 25;
          
          let totalExchangeValue = 0;
          exchangeItems.forEach((item) => {
            if (item.exchangeProductName) {
              const exchangeTotal = parseFloat(returnData.exchangeValue || '0') / exchangeItems.length;
              doc.text(item.exchangeProductName, 50, yPosition, { width: 260 });
              doc.text(item.quantity.toString(), 320, yPosition);
              doc.text(`inr ${(exchangeTotal / item.quantity).toFixed(2)}`, 380, yPosition);
              doc.text(`inr ${exchangeTotal.toFixed(2)}`, 480, yPosition, { align: 'right' });
              totalExchangeValue += exchangeTotal;
              yPosition += 25;
            }
          });
        }

        // Financial Summary
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 15;
        doc.fontSize(10).font('Helvetica');
        
        doc.text('Return Value:', 320, yPosition);
        doc.text(`inr ${totalReturnValue.toFixed(2)}`, 480, yPosition, { align: 'right' });
        yPosition += 20;
        
        // Show refund/credit details
        if (returnData.refundAmount && parseFloat(returnData.refundAmount) > 0) {
          doc.text('Refund Amount:', 320, yPosition);
          doc.text(`inr ${returnData.refundAmount}`, 480, yPosition, { align: 'right' });
          yPosition += 20;
        }
        
        if (returnData.creditAmount && parseFloat(returnData.creditAmount) > 0) {
          doc.text('Store Credit:', 320, yPosition);
          doc.text(`inr ${returnData.creditAmount}`, 480, yPosition, { align: 'right' });
          yPosition += 20;
        }

        if (returnData.exchangeValue && parseFloat(returnData.exchangeValue) > 0) {
          doc.text('Exchange Value:', 320, yPosition);
          doc.text(`inr ${returnData.exchangeValue}`, 480, yPosition, { align: 'right' });
          yPosition += 25;
          
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 15;
          
          doc.fontSize(12).font('Helvetica-Bold');
          if (returnData.refundAmount && parseFloat(returnData.refundAmount) > 0) {
            doc.text('Refund Amount:', 320, yPosition);
            doc.text(`inr ${returnData.refundAmount}`, 480, yPosition, { align: 'right' });
          } else if (returnData.additionalPayment && parseFloat(returnData.additionalPayment) > 0) {
            doc.text('Additional Payment:', 320, yPosition);
            doc.text(`inr ${returnData.additionalPayment}`, 480, yPosition, { align: 'right' });
          } else {
            doc.text('Even Exchange:', 320, yPosition);
            doc.text('inr 0.00', 480, yPosition, { align: 'right' });
          }
        } else {
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 15;
          doc.fontSize(12).font('Helvetica-Bold');
          doc.text('Refund Amount:', 320, yPosition);
          doc.text(`inr ${returnData.refundAmount}`, 480, yPosition, { align: 'right' });
        }

        // Reason
        if (returnData.reason) {
          doc.moveDown(1.5);
          doc.fontSize(10).font('Helvetica-Bold').text('Return Reason:', 50);
          doc.fontSize(10).font('Helvetica').text(returnData.reason, 50);
        }

        // Notes
        if (returnData.notes) {
          doc.moveDown(1);
          doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50);
          doc.fontSize(10).font('Helvetica').text(returnData.notes, 50);
        }

        // Terms and conditions
        this.addTermsAndConditions(doc);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  generateInvoice(order: OrderWithItems): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Store header
        this.addStoreHeader(doc);

        // Invoice title
        doc.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
        doc.moveDown(0.5);

        // Invoice details (right aligned)
        const detailsStartY = doc.y;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Invoice No: ${order.orderNumber}`, 350, detailsStartY, { align: 'right' });
        doc.text(`Date: ${order.date
    ? (typeof order.date === 'string'
        ? order.date
        : order.date.toISOString()
      )
        .replace('T', ' ')
        .replace('Z', '')
    : 'N/A'}`, 350, detailsStartY + 15, { align: 'right' });
        doc.text(`Payment: ${(order.paymentMethod || 'cash').replace(/_/g, ' ').toUpperCase()}`, 350, detailsStartY + 30, { align: 'right' });
        
        // Show payment breakdown if payment method is mixed
        if (order.paymentMethod === 'mixed' && order.payments && order.payments.length > 0) {
          let paymentY = detailsStartY + 45; // Start below the payment method line
          order.payments.forEach((payment, index) => {
            doc.text(`${payment.paymentMethod.replace(/_/g, ' ').toUpperCase()}: inr ${parseFloat(payment.amount).toFixed(2)}`, 350, paymentY, { align: 'right' });
            paymentY += 15; // Move down for next payment method
          });
        }

        // Customer details (left side)
        doc.y = detailsStartY;
        this.addCustomerInfo(doc, order.customerName, order.customerEmail || undefined, order.customerPhone || undefined);
        
        doc.moveDown(2);

        // Items table header
        const tableTop = doc.y;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('SKU', 200, tableTop);
        doc.text('Qty', 320, tableTop);
        doc.text('Price', 380, tableTop);
        doc.text('Total', 480, tableTop, { align: 'right' });
        
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        // Items
        doc.font('Helvetica');
        let yPosition = tableTop + 25;
        
        order.items.forEach((item) => {
          doc.text(item.productName, 50, yPosition, { width: 140 });
          doc.text(item.sku, 200, yPosition);
          doc.text(item.quantity.toString(), 320, yPosition);
          doc.text(`inr ${item.unitPrice}`, 380, yPosition);
          doc.text(`inr ${item.subtotal}`, 480, yPosition, { align: 'right' });
          yPosition += 25;
        });

        // Discount information if applicable
        if (order.discountAmount && order.discountAmount !== null && order.discountAmount !== undefined && parseFloat(order.discountAmount.toString()) > 0) {
          // Subtotal
          doc.text('Subtotal:', 320, yPosition);
          doc.text(`inr ${parseFloat((order.subTotal?.toString() || '0')).toFixed(2)}`, 480, yPosition, { align: 'right' });
          yPosition += 20;
          
          // Discount details
          doc.fontSize(12).font('Helvetica-Bold');
          if (order.discountPercentage && order.discountPercentage !== null && order.discountPercentage !== undefined && parseFloat(order.discountPercentage.toString()) > 0) {
            doc.text(`Discount (${parseFloat(order.discountPercentage.toString()).toFixed(2)}%):`, 320, yPosition);
          } else {
            doc.text('Discount:', 320, yPosition);
          }
          doc.text(`-inr ${parseFloat(order.discountAmount.toString()).toFixed(2)}`, 480, yPosition, { align: 'right' });
          yPosition += 25;
          
          // Final total after discount
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 15;
          
          doc.fontSize(14).font('Helvetica-Bold');
          doc.text('TOTAL AFTER DISCOUNT:', 320, yPosition);
          doc.text(`inr ${Math.floor(parseFloat(order.totalAmount.toString()))}`, 480, yPosition, { align: 'right' });
          
          // Reset font back to normal for subsequent text
          doc.fontSize(10).font('Helvetica');
        } else {
          // Total
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 15;
          doc.fontSize(14).font('Helvetica-Bold');
          doc.text('GRAND TOTAL:', 320, yPosition);
          doc.text(`inr ${Math.floor(parseFloat(order.totalAmount.toString()))}`, 480, yPosition, { align: 'right' });
        }

        // Amount in words (optional - you can implement this)
        yPosition += 25;
        doc.fontSize(9).font('Helvetica-Oblique');
        doc.text(`Amount in words: (Add conversion logic if needed)`, 50, yPosition);

        // Notes
        if (order.notes) {
          doc.moveDown(1.5);
          doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50);
          doc.fontSize(10).font('Helvetica').text(order.notes, 50);
        }

        // Terms and conditions
        this.addTermsAndConditions(doc);

        // Footer with signature line
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        doc.text('Authorized Signature: _____________________', 350, doc.y, { align: 'right' });
        
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const pdfService = new PDFService();
