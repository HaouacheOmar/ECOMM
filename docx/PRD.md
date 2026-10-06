Project Purpose: Portfolio demonstration piece (Not for commercial client use)

1. Project Overview
A comprehensive, full-stack e-commerce web application designed to demonstrate advanced web development capabilities. The platform includes role-based access control, real-time bidirectional communication, dynamic product showcasing algorithms, and a complete end-to-end purchasing lifecycle from guest browsing to order fulfillment.

2. User Roles & Permissions
Admin: The single owner account, created at setup (no sign-up). Has root access to the platform. Manages Employee accounts, product inventory and Pickup Points, and monitors global order streams and Employee activity.
Employee: Operates within a dedicated Employee portal. Handles real-time customer inquiries via chat, sees all orders live, and can ship, deliver or cancel orders.
Registered Customer: Authenticated user who can place and cancel orders, view history, leave reviews, and receive personalized recommendations.
Guest (Unauthenticated User): Can browse the catalog, view product details, and add items to a temporary shopping cart.

3. Core Use Cases & Functional Requirements
3.1. Authentication & Account Management
    Employee Provisioning: The Admin creates, provisions and deactivates Employee accounts. A deactivated Employee cannot log in; their assigned Customers return to the Support Queue.
    Activity Auditing: The Admin dashboard displays a real-time log of Employee Sessions: explicit login and logout timestamps only (closing the tab does not record a logout).
    Customer Registration: Customers create accounts using an email and password, with a required password confirmation step.
    Email Verification: Customers verify their email via an automated link. Unverified Customers can log in, browse and fill a cart, but cannot confirm an order.
    Role-Based Workspaces: Admin, Employees, and Customers are routed to their respective dedicated dashboards upon authentication.

3.2. Product & Catalog Management
    Product Creation: Admins can post new products to the boutique.
    Product Attributes: Each product entity includes: Name, Description, Price, Aggregate Rating, Photos, exactly one Category (flat, no subcategories), and current Stock Level.
    Product Archiving: Removing a product archives it: hidden from the catalog and carts, kept in order history.
    Out of Stock: Products with zero stock stay listed, marked "Out of stock", and cannot be added to a cart.
    Catalog Browsing & Filtering: Users can filter the catalog by Category or search by Product Name.
    Bestsellers: The front page shows the 8 products with the most units sold in non-cancelled orders over the last 30 days; empty slots are filled with the newest products. No manual pinning.
    Inventory Management: Stock levels automatically decrement the moment a customer confirms an order, and are restored if the order is cancelled. Carts never reserve stock.

3.3. Shopping Cart & Checkout Process
    Guest Cart: Users can build and manage a shopping cart without creating an account. Account creation or login is prompted during the checkout phase. On login, the guest cart is merged into the Customer's saved cart (quantities summed, capped at stock).
    Order Validation: Customers review and validate their selected products before finalizing the order. Confirming creates the order with status Confirmed; if stock ran out meanwhile, confirmation fails and the cart is updated.
    Payment: Cash on delivery. No online payment and no delivery fees.
    Delivery Selection: During checkout, customers choose between two fulfillment methods:
    Home Delivery (Address-based)
    Pickup Point: chosen from a list of collection offices (name, city, address) maintained by the Admin

3.4. Order Management & History
    Real-Time Order Feed: The Admin and all Employees receive real-time notifications on their dashboard the moment a customer confirms an order.
    Order Lifecycle: Confirmed -> Shipped -> Delivered, moved by the Admin or an Employee. Delivered is final (no returns).
    Cancellation: The Customer, Admin, or an Employee can cancel an order before it is Shipped; its stock is restored.
    Customer Order History: Registered customers can view a detailed log of all their past purchases.
    Admin Sales History: Admins have access to a global history of all purchased products across the platform.

3.5. Customer Engagement & Support
    Product Reviews: Any Customer can review any product with a 1-5 rating and optional text, at most once per product; reviewing again edits the existing review.
    Personalized Recommendations: Highly rated products from categories the Customer has bought from, excluding products already purchased. Based on purchase history only. Customers with no purchases (and Guests) see the Bestsellers instead.
    Real-Time Live Chat: Registered Customers (not Guests) chat in real time with Employees via direct messages. A Customer's message goes to their Assigned Employee if that Employee is Online (connected to chat); otherwise it goes to a Support Queue visible to all Employees. Whoever answers from the Queue becomes the Assigned Employee. The Customer's whole chat history is visible to them and to any Employee handling them. See docs/adr/0001-direct-messages-with-support-queue.md.