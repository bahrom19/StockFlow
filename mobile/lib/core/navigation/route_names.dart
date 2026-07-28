/// StockFlow Route Names
/// Central registry for all named routes.
class RouteNames {
  RouteNames._();

  static const String splash = '/';
  static const String login = '/login';
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
  static const String finance = '/finance';
  static const String reports = '/reports';

  // System routes
  static const String notFound = '/404';
  static const String maintenance = '/maintenance';
  static const String noInternet = '/no-internet';
}
