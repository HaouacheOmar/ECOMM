Database Schema Design

This schema outlines the relational structure required for the E-Shop platform. It is designed for a SQL database (like PostgreSQL or MySQL).
1. Users & Access Management
Table: Users

    id (PK, UUID)
    email (VARCHAR, Unique)
    password_hash (VARCHAR)
    role (ENUM: 'ADMIN', 'EMPLOYEE', 'CUSTOMER')
    is_email_verified (BOOLEAN, default: false)
    is_active (BOOLEAN, default: true) - false = deactivated Employee
    assigned_employee_id (FK -> Users.id, Nullable) - Customers only; their Assigned Employee
    created_at (TIMESTAMP)
    Table: Employee_Audits
    id (PK, UUID)
    employee_id (FK -> Users.id)
    login_time (TIMESTAMP)
    logout_time (TIMESTAMP, nullable)

2. Product Catalog & Inventory
Table: Categories

    id (PK, UUID)
    name (VARCHAR, Unique)
    description (TEXT)
    Table: Products
    id (PK, UUID)
    name (VARCHAR)
    description (TEXT)
    price (DECIMAL)
    stock_quantity (INTEGER)
    category_id (FK -> Categories.id)
    rating_avg (DECIMAL, default: 0.0)
    is_archived (BOOLEAN, default: false) - archived products are hidden from catalog and carts
    (No sales_count: Bestsellers are computed from non-cancelled Order_Items of the last 30 days)
    created_at (TIMESTAMP)


Table: Product_Images

    id (PK, UUID)
    product_id (FK -> Products.id)
    image_url (VARCHAR)
    is_primary (BOOLEAN)
    Table: Product_Reviews
    id (PK, UUID)
    product_id (FK -> Products.id)
    customer_id (FK -> Users.id)
    rating (INTEGER, 1-5)
    review_text (TEXT, Nullable)
    created_at (TIMESTAMP)
    updated_at (TIMESTAMP)
    UNIQUE (product_id, customer_id)

3. Cart & Ordering System
Table: Carts

    id (PK, UUID)
    customer_id (FK -> Users.id, Nullable for Guests)
    session_id (VARCHAR, Nullable - used if customer_id is null)
    updated_at (TIMESTAMP)
    Table: Cart_Items
    id (PK, UUID)
    cart_id (FK -> Carts.id)
    product_id (FK -> Products.id)
    quantity (INTEGER)
    Table: Orders
    id (PK, UUID)
    customer_id (FK -> Users.id)
    status (ENUM: 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    delivery_method (ENUM: 'HOME_DELIVERY', 'PICKUP_POINT')
    delivery_address (TEXT, Nullable) - required for HOME_DELIVERY
    pickup_point_id (FK -> Pickup_Points.id, Nullable) - required for PICKUP_POINT
    total_amount (DECIMAL)
    created_at (TIMESTAMP)
    Table: Order_Items
    id (PK, UUID)
    order_id (FK -> Orders.id)
    product_id (FK -> Products.id)
    quantity (INTEGER)
    price_at_purchase (DECIMAL) - Crucial for historical accuracy if product prices change
    Table: Pickup_Points
    id (PK, UUID)
    name (VARCHAR)
    city (VARCHAR)
    address (TEXT)
    is_active (BOOLEAN, default: true)

4. Real-Time Customer Support
Table: Chat_Messages

    id (PK, UUID)
    sender_id (FK -> Users.id)
    receiver_id (FK -> Users.id, Nullable) - null = in the Support Queue (no Online Assigned Employee)
    message_body (TEXT)
    is_read (BOOLEAN, default: false)
    timestamp (TIMESTAMP)