/// StockFlow API Endpoints
/// Central registry of all backend API routes.
class ApiEndpoints {
  ApiEndpoints._();

  // ──────────────────────────────────
  // Auth
  // ──────────────────────────────────
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';

  // ──────────────────────────────────
  // Dashboard
  // ──────────────────────────────────
  static const String dashboard = '/reports/dashboard';

  // ──────────────────────────────────
  // Products
  // ──────────────────────────────────
  static const String products = '/products';
  static const String productVariants = '/inventory/variants';
  static const String productBarcodes = '/inventory/barcodes';

  // ──────────────────────────────────
  // Inventory
  // ──────────────────────────────────
  static const String inventory = '/inventory';
  static const String stockMovements = '/inventory/stock/movements';
  static const String warehouses = '/inventory/warehouses';
  static const String stockAdjustments = '/inventory/stock/adjust';
  static const String stockTransfers = '/inventory/stock/transfer';

  // ──────────────────────────────────
  // Sales
  // ──────────────────────────────────
  static const String sales = '/sales';
  static const String salesReceipt = '/sales/receipt';
  static const String salesNextNumber = '/sales/next-number';

  // ──────────────────────────────────
  // Purchasing
  // ──────────────────────────────────
  static const String purchaseOrders = '/purchasing/purchase-orders';
  static const String goodsReceipt = '/purchasing/goods-receipts';
  static const String purchaseReturns = '/purchasing/purchase-returns';

  // ──────────────────────────────────
  // CRM
  // ──────────────────────────────────
  static const String customers = '/customers';
  static const String customerGroups = '/crm/customer-groups';
  static const String contacts = '/crm/contacts';
  static const String opportunities = '/crm/opportunities';

  // ──────────────────────────────────
  // Finance
  // ──────────────────────────────────
  static const String chartOfAccounts = '/finance/chart-of-accounts';
  static const String journalEntries = '/finance/journal-entries';
  static const String financialPeriods = '/finance/financial-periods';
  static const String cashAccounts = '/finance/cash-accounts';

  // ──────────────────────────────────
  // Reports
  // ──────────────────────────────────
  static const String reportsSales = '/reports/sales';
  static const String reportsTopProducts = '/reports/products/top';
  static const String reportsLowStock = '/reports/inventory/low-stock';
  static const String reportsInventoryValue = '/reports/inventory/value';
  static const String reportsCustomers = '/reports/customers';
  static const String reportsSuppliers = '/reports/suppliers';
  static const String reportsPurchasing = '/reports/purchasing';
  static const String reportsProfit = '/reports/profit';

  // ──────────────────────────────────
  // Billing
  // ──────────────────────────────────
  static const String billingPlans = '/billing/plans';
  static const String billingSubscription = '/billing/subscription';
  static const String billingInvoices = '/billing/invoices';
  static const String billingPortal = '/billing/portal';
}
