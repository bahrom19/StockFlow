/// StockFlow Route Names
/// Central registry for all named routes.
class RouteNames {
  RouteNames._();

  static const String splash = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String dashboard = '/dashboard';
  static const String settings = '/settings';
  static const String profile = '/profile';

  // Feature routes (Phase 4+)
  static const String inventory = '/inventory';
  static const String movements = '/inventory/movements';
  static const String products = '/products';
  static const String productDetail = '/products/:id';
  static const String productCreate = '/products/new';
  static const String productEdit = '/products/:id/edit';
  static const String productImport = '/products/import';
  // Sales
  static const String sales = '/sales';
  static const String saleNew = '/sales/new';
  static const String saleDetail = '/sales/:id';
  static const String saleReceipt = '/sales/receipt/:id';
  // Purchasing & Suppliers
  static const String purchasing = '/purchasing';
  static const String poNew = '/purchasing/new';
  static const String poDetail = '/purchasing/:id';
  static const String suppliers = '/suppliers';
  static const String supplierNew = '/suppliers/new';
  static const String supplierDetail = '/suppliers/:id';
  static const String customers = '/customers';
  static const String customerNew = '/customers/new';
  static const String customerDetail = '/customers/:id';
  static const String finance = '/finance';
  static const String reports = '/reports';
  // Payment Analytics (v1.2 Phase 2)
  static const String payments = '/payments';
  static const String paymentDetails = '/payments/details';
  static const String warehouses = '/warehouses';
  static const String warehouseNew = '/warehouses/new';
  static const String warehouseEdit = '/warehouses/:id/edit';

  // System routes
  static const String notFound = '/404';
  static const String maintenance = '/maintenance';
  static const String noInternet = '/no-internet';
}
