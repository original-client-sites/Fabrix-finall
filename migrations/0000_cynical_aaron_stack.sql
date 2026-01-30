CREATE TABLE `accounts` (
	`id` varchar(36) NOT NULL,
	`transaction_type` varchar(50) NOT NULL,
	`reference_id` varchar(36),
	`reference_number` varchar(50),
	`revenue` decimal(10,2) NOT NULL DEFAULT '0.00',
	`cost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`profit` decimal(10,2) NOT NULL DEFAULT '0.00',
	`tax_amount` decimal(10,2) DEFAULT '0.00',
	`discount_amount` decimal(10,2) DEFAULT '0.00',
	`shipping_cost` decimal(10,2) DEFAULT '0.00',
	`product_id` varchar(36),
	`product_name` varchar(255),
	`category` varchar(100),
	`quantity` int DEFAULT 0,
	`customer_name` varchar(100),
	`customer_email` varchar(150),
	`notes` text,
	`fiscal_year` int,
	`fiscal_month` int,
	`fiscal_quarter` int,
	`transaction_date` timestamp DEFAULT CURRENT_TIMESTAMP,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`customer_email` varchar(150) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`is_used` boolean DEFAULT false,
	`used_at` timestamp,
	`expires_at` timestamp,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `discount_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`sku` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`order_number` varchar(50) NOT NULL,
	`customer_name` varchar(100) NOT NULL,
	`customer_email` varchar(150),
	`customer_phone` varchar(20),
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`payment_method` varchar(50) NOT NULL,
	`notes` text,
	`sub_total` decimal(10,2),
	`discount_percentage` decimal(5,2),
	`discount_amount` int,
	`total_amount` int NOT NULL,
	`date` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_details` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`payment_method` varchar(50) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`payment_date` timestamp DEFAULT CURRENT_TIMESTAMP,
	`transaction_id` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'completed',
	`notes` text,
	CONSTRAINT `payment_details_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`sku` varchar(100) NOT NULL,
	`category` varchar(100) NOT NULL,
	`brand` varchar(100),
	`description` text,
	`color` varchar(50),
	`size` varchar(50) NOT NULL,
	`fabric` varchar(100),
	`pattern` varchar(100),
	`gender` varchar(20),
	`price` decimal(10,2) NOT NULL,
	`cost_price` decimal(10,2),
	`stock_quantity` int NOT NULL DEFAULT 0,
	`warehouse` varchar(100),
	`product_image` text,
	`gallery_images` text,
	`is_featured` boolean DEFAULT false,
	`launch_date` timestamp,
	`rating` varchar(10),
	`tags` text,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` varchar(36) NOT NULL,
	`return_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`sku` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`exchange_product_id` varchar(36),
	`exchange_product_name` varchar(255),
	CONSTRAINT `return_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` varchar(36) NOT NULL,
	`return_number` varchar(50) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`order_number` varchar(50) NOT NULL,
	`customer_name` varchar(100) NOT NULL,
	`customer_email` varchar(150),
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`payment_method` varchar(50) NOT NULL DEFAULT 'cash',
	`reason` varchar(255) NOT NULL,
	`notes` text,
	`refund_amount` decimal(10,2),
	`credit_amount` decimal(10,2),
	`exchange_value` decimal(10,2),
	`additional_payment` decimal(10,2),
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`sku` varchar(100) NOT NULL,
	`type` varchar(50) NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`notes` text,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
