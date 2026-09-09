# Product Requirements Document (PRD)

**Product Name:** Simon POS (Սիմոն)
**GitHub Repository:** `simon-pos`
**Document Version:** Final (Self-Hosted, Offline-First Monorepo)
**Target Market:** Small to Medium Retail & Hardware Stores in Armenia
**Primary UI Language:** Armenian (System backend, code, and comments in English)
**Currency:** Armenian Dram (AMD)

## 1. Product Overview & Brand Vision
"Simon" is not just a software application; it is positioned as a digital employee—a trusted, tireless clerk and accountant for traditional Armenian store owners. The system is designed to completely replace paper notebooks used for inventory tracking and "Nisya" (customer debt), utilizing an intuitive barcode-scanning mobile web app for store workers and a web dashboard for the store owner.

Crucially, **this system is 100% self-hosted**. It runs entirely on the store's local computer and internal Wi-Fi network (LAN) to ensure maximum privacy, security, and offline resilience, respecting the local business owners' preference for keeping data on their own hard drives.

## 2. Technology Stack (Mandatory Constraints)
The application must be built as a decoupled Client-Server architecture running locally.
**Do NOT use Next.js or Server-Side Rendering (SSR).**

*   **Monorepo Structure:** `/frontend` and `/backend`
*   **Database:** SQLite (Single `.db` file for easy local USB backups).
*   **Backend:** Node.js with Express.js (REST API).
*   **ORM:** Prisma.
*   **Frontend (UI):** React.js (built with Vite) as a pure Single Page Application (SPA).
*   **Styling:** Tailwind CSS (Large, touch-friendly UI for workers).
*   **Barcode Scanning:** `html5-qrcode` or `react-zxing` for client-side camera access.
*   **PWA:** `vite-plugin-pwa` so workers can add the app to their mobile home screens.
*   **Deployment:** Docker Compose (Phase 1) and Tauri (Phase 2) to package it as a desktop executable.

## 3. Core Features & Requirements

### 3.1. Mobile POS (For Workers)
*   **One-Tap Camera Scanning:** Instant barcode recognition.
*   **Fast Checkout UI:** Minimal typing. Large number pads.
*   **Multi-Unit Support (UoM):** Support for pieces (հատ), meters (մետր), kilograms (կգ), and bags (պարկ), including decimal inputs (e.g., 2.5 kg).
*   **Shift Management:** Open/Close shift functionality to track daily cash drawer totals.

### 3.2. Customer Debt Management ("Nisya")
*   **Trust Ledger:** A digital registry of trusted customers/contractors.
*   **Debt Assignment:** During checkout, the worker selects "Debt" (Պարտք) and chooses the customer. The total is automatically added to the customer's balance.
*   **Debt Repayment:** A dedicated screen to log partial or full cash payments against a customer's debt.

### 3.3. Inventory Management
*   **Automated Low-Stock Thresholds:** Color-coded indicators for the Admin (Green = Healthy, Yellow = Reorder soon, Red = Out of stock).
*   **Restock/Returns:** Simple flows to add new inventory or process customer returns.

### 3.4. Admin Dashboard (For the Owner)
*   **Real-time Analytics:** Gross Revenue, Net Profit, Top Selling Items, and Total Outstanding Debt (viewed on the host PC).
*   **Cost Price Privacy:** Standard workers cannot see the `CostPrice` or profit margins.
*   **Automated Backup:** A script that exports the SQLite database to a local CSV/Excel or backup `.db` file daily at 20:00.

---

## 4. Database Schema (Prisma representation guide)

| Model | Fields | Description / Relations |
| :--- | :--- | :--- |
| **Product** | `id` (UUID), `barcode` (String), `name` (String), `uom` (String), `costPrice` (Float), `sellPrice` (Float), `stockQty` (Float) | Stores all inventory. `stockQty` supports decimals. |
| **Customer** | `id` (UUID), `fullName` (String), `phone` (String), `discountTier` (Float), `currentDebt` (Float) | Tracks trusted buyers and their total debts. |
| **Sale** | `id` (UUID), `timestamp` (DateTime), `cashierName` (String), `totalAmount` (Float), `paymentType` (Enum: Cash, Card, Debt), `customerId` (UUID - Optional) | The main transaction record. |
| **LineItem** | `id` (UUID), `saleId` (UUID), `productId` (UUID), `quantity` (Float), `appliedPrice` (Float) | Links multiple products to a single Sale. |
| **Transaction**| `id` (UUID), `type` (Enum: Repayment, ShiftOpen, ShiftClose), `amount` (Float), `date` (DateTime), `customerId` (UUID - Optional) | Tracks money movements outside of direct product sales. |

---

## 5. Network & Security Architecture
*   **LAN Binding:** The Express server must bind to `0.0.0.0` (not just `localhost`) to accept API requests from mobile devices connected to the store's Wi-Fi.
*   **CORS:** Configured to accept traffic from local network IPs (e.g., `192.168.1.X`).
*   **Role-Based Access:** The app should have a basic PIN or role system separating "Worker Mode" (POS only) from "Admin Mode" (Dashboard, Cost Prices, DB management).

---

## 6. Execution Instructions for AI Developer
1.  **Initialize Monorepo:** Create the `/backend` and `/frontend` directories.
2.  **Prisma Setup:** Write the `schema.prisma` file based on Section 4. Generate the SQLite database.
3.  **Backend API:** Build RESTful routes for Products, Customers, Sales, and Transactions. Ensure atomic transactions when a Sale is created (deduct stock AND increase debt simultaneously if applicable).
4.  **Frontend Setup:** Scaffold the Vite React app. Set up Tailwind. Build the UI with Armenian labels (e.g., "Վաճառել", "Սկանավորել", "Պարտքեր").
5.  **Dockerization:** Provide a `docker-compose.yml` that runs both the Express backend and serves the Vite static build via Nginx on a single port for the host machine.
