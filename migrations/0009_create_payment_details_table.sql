-- Migration to create payment_details table
CREATE TABLE `payment_details` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `order_id` varchar(36) NOT NULL,
  `payment_method` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` timestamp DEFAULT CURRENT_TIMESTAMP,
  `transaction_id` varchar(255),
  `status` varchar(50) NOT NULL DEFAULT 'completed',
  `notes` text
);

-- Add foreign key constraint to orders table
ALTER TABLE `payment_details` ADD FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`);

-- Index for better query performance
CREATE INDEX `idx_payment_details_order_id` ON `payment_details`(`order_id`);
CREATE INDEX `idx_payment_details_payment_method` ON `payment_details`(`payment_method`);
CREATE INDEX `idx_payment_details_status` ON `payment_details`(`status`);