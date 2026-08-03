import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/customers/presentation/screens/customer_form_screen.dart';
import '../../features/customers/presentation/screens/customers_list_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/finance/presentation/screens/finance_screen.dart';
import '../../features/inventory/presentation/screens/inventory_list_screen.dart';
import '../../features/inventory/presentation/screens/movements_screen.dart';
import '../../features/products/presentation/screens/product_detail_screen.dart';
import '../../features/products/presentation/screens/product_form_screen.dart';
import '../../features/products/presentation/screens/products_list_screen.dart';
import '../../features/purchasing/presentation/screens/purchase_order_list_screen.dart';
import '../../features/purchasing/presentation/screens/purchase_order_detail_screen.dart';
import '../../features/purchasing/presentation/screens/purchase_order_form_screen.dart';
import '../../features/reports/presentation/screens/reports_screen.dart';
import '../../features/sales/presentation/screens/pos_screen.dart';
import '../../features/sales/presentation/screens/sale_history_screen.dart';
import '../../features/sales/presentation/screens/sale_detail_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/settings/presentation/screens/profile_screen.dart';
import '../../features/suppliers/presentation/screens/suppliers_list_screen.dart';
import '../../features/suppliers/presentation/screens/supplier_form_screen.dart';
import '../../features/warehouses/presentation/screens/warehouse_form_screen.dart';
import '../../features/warehouses/presentation/screens/warehouses_list_screen.dart';
import '../auth/auth_state.dart';
import '../shell/app_shell.dart';
import 'route_names.dart';

// ──────────────────────────────────
// GoRouter Provider
// ──────────────────────────────────
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: RouteNames.splash,
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuthenticated = authState is AuthAuthenticated;
      final isAuthRoute = state.matchedLocation == RouteNames.login;
      final isSplashRoute = state.matchedLocation == RouteNames.splash;

      if (isSplashRoute) return null;

      if (!isAuthenticated && !isAuthRoute) {
        return RouteNames.login;
      }

      if (isAuthenticated && isAuthRoute) {
        return RouteNames.dashboard;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: RouteNames.splash,
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: RouteNames.login,
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: RouteNames.dashboard,
            name: 'dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: RouteNames.sales,
            name: 'sales',
            builder: (context, state) => const SaleHistoryScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: 'saleNew',
                builder: (context, state) => const PosScreen(),
              ),
              GoRoute(
                path: ':id',
                name: 'saleDetail',
                builder: (context, state) => SaleDetailScreen(
                  saleId: state.pathParameters['id'] ?? '',
                ),
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.inventory,
            name: 'inventory',
            builder: (context, state) => const InventoryListScreen(),
            routes: [
              GoRoute(
                path: 'movements',
                name: 'movements',
                builder: (context, state) => const MovementsScreen(),
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.products,
            name: 'products',
            builder: (context, state) => const ProductsListScreen(),
          ),
          GoRoute(
            path: RouteNames.productCreate,
            name: 'productCreate',
            builder: (context, state) => const ProductFormScreen(),
          ),
          GoRoute(
            path: RouteNames.productDetail,
            name: 'productDetail',
            builder: (context, state) => ProductDetailScreen(
              productId: state.pathParameters['id'] ?? '',
            ),
          ),
          GoRoute(
            path: RouteNames.productEdit,
            name: 'productEdit',
            builder: (context, state) => ProductFormScreen(
              product: null, // will be loaded from state
            ),
          ),
          GoRoute(
            path: RouteNames.purchasing,
            name: 'purchasing',
            builder: (context, state) => const PurchaseOrderListScreen(),
            routes: [
              GoRoute(path: 'new', name: 'poNew', builder: (context, state) => const PurchaseOrderFormScreen()),
              GoRoute(path: ':id', name: 'poDetail', builder: (context, state) => PurchaseOrderDetailScreen(orderId: state.pathParameters['id'] ?? '')),
            ],
          ),
          GoRoute(
            path: RouteNames.suppliers,
            name: 'suppliers',
            builder: (context, state) => const SuppliersListScreen(),
            routes: [
              GoRoute(path: 'new', name: 'supplierNew', builder: (context, state) => const SupplierFormScreen()),
              GoRoute(path: ':id', name: 'supplierDetail', builder: (context, state) => SupplierFormScreen(supplier: null)),
            ],
          ),
          GoRoute(
            path: RouteNames.customers,
            name: 'customers',
            builder: (context, state) => const CustomersListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: 'customerNew',
                builder: (context, state) => const CustomerFormScreen(),
              ),
              GoRoute(
                path: ':id',
                name: 'customerDetail',
                builder: (context, state) => CustomerFormScreen(
                  customerId: state.pathParameters['id'],
                ),
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.warehouses,
            name: 'warehouses',
            builder: (context, state) => const WarehousesListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: 'warehouseNew',
                builder: (context, state) => const WarehouseFormScreen(),
              ),
              GoRoute(
                path: ':id/edit',
                name: 'warehouseEdit',
                builder: (context, state) => WarehouseFormScreen(
                  warehouseId: state.pathParameters['id'],
                ),
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.reports,
            name: 'reports',
            builder: (context, state) => const ReportsScreen(),
          ),
          GoRoute(
            path: RouteNames.finance,
            name: 'finance',
            builder: (context, state) => const FinanceScreen(),
          ),
          GoRoute(
            path: RouteNames.settings,
            name: 'settings',
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: RouteNames.profile,
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
      GoRoute(
        path: RouteNames.notFound,
        name: 'notFound',
        builder: (context, state) => const _NotFoundScreen(),
      ),
      GoRoute(
        path: RouteNames.maintenance,
        name: 'maintenance',
        builder: (context, state) => const _MaintenanceScreen(),
      ),
      GoRoute(
        path: RouteNames.noInternet,
        name: 'noInternet',
        builder: (context, state) => const _NoInternetScreen(),
      ),
    ],
    errorBuilder: (context, state) => const _NotFoundScreen(),
  );
});

// ──────────────────────────────────
// System Screens
// ──────────────────────────────────
class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Page Not Found')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.search_off, size: 80, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('404', style: theme.textTheme.displaySmall),
              const SizedBox(height: 8),
              Text('The page you are looking for does not exist.',
                  style: theme.textTheme.bodyLarge),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => context.go(RouteNames.dashboard),
                icon: const Icon(Icons.home),
                label: const Text('Go Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MaintenanceScreen extends StatelessWidget {
  const _MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.construction, size: 80, color: theme.colorScheme.tertiary),
              const SizedBox(height: 16),
              Text('Under Maintenance', style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text('We are performing scheduled maintenance.\nPlease check back shortly.',
                  style: theme.textTheme.bodyLarge, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoInternetScreen extends StatelessWidget {
  const _NoInternetScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off, size: 80, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('No Internet Connection', style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text('Please check your connection and try again.',
                  style: theme.textTheme.bodyLarge, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => context.go(RouteNames.dashboard),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
