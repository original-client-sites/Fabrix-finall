
# Database Information

This project uses a MySQL database for all operations.

## Database Architecture

### Database: MySQL
- Used when `DATABASE_URL` environment variable is set
- Production-ready relational database
- Handles all operations

## Database Schemas

Both databases have identical table structures:

### Tables
1. **products** - Product inventory
2. **orders** - Customer orders
3. **order_items** - Line items for orders
4. **stock_movements** - Inventory movement history
5. **stock_stats** - Aggregated stock statistics
6. **returns** - Product returns
7. **return_items** - Line items for returns
8. **discount_codes** - Promotional discount codes
9. **accounts** - Profit & Loss accounting records

## MySQL Commands

### Connect to MySQL
```bash
mysql -h <host> -u <username> -p <database_name>
```

### View All Tables
```sql
SHOW TABLES;
```

### Describe Table Structure
```sql
DESCRIBE products;
DESCRIBE orders;
DESCRIBE accounts;
```

### View All Products
```sql
SELECT * FROM products;
```

### View Recent Orders
```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
```

### Check Stock Levels
```sql
SELECT product_name, sku, stock_quantity FROM products WHERE stock_quantity < 10;
```

### View Profit & Loss Summary
```sql
SELECT 
  transaction_type,
  SUM(revenue) as total_revenue,
  SUM(cost) as total_cost,
  SUM(profit) as total_profit
FROM accounts
GROUP BY transaction_type;
```

### Export Database
```bash
mysqldump -h <host> -u <username> -p <database_name> > backup.sql
```

### Import Database
```bash
mysql -h <host> -u <username> -p <database_name> < backup.sql
```

### Count Records
```sql
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM accounts;
```


## Drizzle Kit Commands

### Push Schema to Database
```bash
npx drizzle-kit push
```

### Generate Migrations
```bash
npx drizzle-kit generate
```

### Run Migrations
```bash
npx drizzle-kit migrate
```

### View Database in Drizzle Studio
```bash
npx drizzle-kit studio
```

## Common Queries

### Find Products by Category
```sql
-- MySQL & SQLite
SELECT * FROM products WHERE category = 'T-Shirts';
```

### Get Order with Items
```sql
-- MySQL & SQLite
SELECT o.*, oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_number = 'ORD-001';
```

### Calculate Total Sales
```sql
-- MySQL & SQLite
SELECT 
  SUM(total_amount) as total_sales,
  COUNT(*) as order_count
FROM orders
WHERE status = 'delivered';
```

### View Stock Movement History
```sql
-- MySQL & SQLite
SELECT * FROM stock_movements 
ORDER BY created_at DESC 
LIMIT 20;
```

### Get Low Stock Products
```sql
-- MySQL & SQLite
SELECT 
  product_name,
  sku,
  stock_quantity,
  category
FROM products
WHERE stock_quantity < 10
ORDER BY stock_quantity ASC;
```

### Monthly Sales Report
```sql
-- MySQL
SELECT 
  DATE_FORMAT(created_at, '%Y-%m') as month,
  COUNT(*) as orders,
  SUM(total_amount) as revenue
FROM orders
GROUP BY month
ORDER BY month DESC;
```

### Purchase vs Sales Profit
```sql
-- MySQL & SQLite
SELECT 
  CASE 
    WHEN transaction_type IN ('purchase', 'adjustment') THEN 'Purchase'
    WHEN transaction_type IN ('sale', 'return') THEN 'Sales'
  END as type,
  SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END) as total_profit,
  SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END) as total_loss
FROM accounts
GROUP BY type;
```

## Troubleshooting

### Check Database Connection
```bash
# MySQL
mysql -h <host> -u <username> -p -e "SELECT 1"
```

### Check Database Sizes
```bash
# MySQL
mysql -e "SELECT table_schema, SUM(data_length + index_length) / 1024 / 1024 'Size (MB)' FROM information_schema.tables WHERE table_schema = 'your_database' GROUP BY table_schema;"
```

## Data Type Notes

| MySQL Type | Notes |
|------------|-------|
| VARCHAR | String data |
| DECIMAL | Numeric with decimals |
| INT | Whole numbers |
| BOOLEAN | Boolean values |
| TIMESTAMP | Timestamp with timezone support |

## Notes

- The project uses MySQL for all database operations
- The schema is maintained via `schema.mysql.ts`
- MySQL uses native TIMESTAMP type with timezone support
