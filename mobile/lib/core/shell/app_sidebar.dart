import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_state.dart';
import '../auth/models/auth_models.dart';
import '../navigation/route_names.dart';
import '../theme/app_spacing.dart';
import '../theme/design_tokens.dart';

/// StockFlow navigation sidebar.
///
/// Renders as a permanent rail on desktop and as a [Drawer] on mobile.
/// The current route is highlighted; the user card exposes Profile,
/// Settings and Logout actions.
class AppSidebar extends ConsumerWidget {
  final String currentLocation;

  const AppSidebar({super.key, required this.currentLocation});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final isActive = _SidebarNav.isActiveFor(currentLocation);

    final content = SafeArea(
      child: Column(
        children: [
          _SidebarHeader(),
          const SizedBox(height: AppSpacing.sm),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
              children: [
                for (final section in _SidebarNav.sections) ...[
                  _SidebarSectionLabel(title: section.title),
                  const SizedBox(height: AppSpacing.xxs),
                  for (final item in section.items)
                    _SidebarItem(
                      item: item,
                      selected: isActive(item.path),
                      onTap: () {
                        context.go(item.path);
                      },
                    ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            ),
          ),
          _SidebarUserCard(
            userName: user?.fullName ?? 'User',
            email: user?.email ?? '',
            initials: _initials(user?.fullName ?? 'U'),
            onProfile: () => context.go(RouteNames.profile),
            onSettings: () => context.go(RouteNames.settings),
            onLogout: () => ref.read(authStateProvider.notifier).logout(),
          ),
        ],
      ),
    );

    return content;
  }

  String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'U';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

// ──────────────────────────────────
// Nav Model
// ──────────────────────────────────
class _SidebarNavItem {
  final String label;
  final String path;
  final IconData icon;
  final IconData selectedIcon;

  const _SidebarNavItem({
    required this.label,
    required this.path,
    required this.icon,
    required this.selectedIcon,
  });
}

class _SidebarNavSection {
  final String title;
  final List<_SidebarNavItem> items;

  const _SidebarNavSection({required this.title, required this.items});
}

class _SidebarNav {
  static const _dashboard = _SidebarNavItem(
    label: 'Dashboard',
    path: RouteNames.dashboard,
    icon: Icons.dashboard_outlined,
    selectedIcon: Icons.dashboard,
  );
  static const _products = _SidebarNavItem(
    label: 'Products',
    path: RouteNames.products,
    icon: Icons.inventory_2_outlined,
    selectedIcon: Icons.inventory_2,
  );
  static const _inventory = _SidebarNavItem(
    label: 'Inventory',
    path: RouteNames.inventory,
    icon: Icons.inventory_outlined,
    selectedIcon: Icons.inventory,
  );
  static const _warehouses = _SidebarNavItem(
    label: 'Warehouses',
    path: RouteNames.warehouses,
    icon: Icons.warehouse_outlined,
    selectedIcon: Icons.warehouse,
  );
  static const _sales = _SidebarNavItem(
    label: 'Sales',
    path: RouteNames.sales,
    icon: Icons.receipt_long_outlined,
    selectedIcon: Icons.receipt_long,
  );
  static const _purchasing = _SidebarNavItem(
    label: 'Purchasing',
    path: RouteNames.purchasing,
    icon: Icons.shopping_cart_outlined,
    selectedIcon: Icons.shopping_cart,
  );
  static const _suppliers = _SidebarNavItem(
    label: 'Suppliers',
    path: RouteNames.suppliers,
    icon: Icons.local_shipping_outlined,
    selectedIcon: Icons.local_shipping,
  );
  static const _customers = _SidebarNavItem(
    label: 'Customers',
    path: RouteNames.customers,
    icon: Icons.people_outline,
    selectedIcon: Icons.people,
  );
  static const _reports = _SidebarNavItem(
    label: 'Reports',
    path: RouteNames.reports,
    icon: Icons.bar_chart_outlined,
    selectedIcon: Icons.bar_chart,
  );
  static const _finance = _SidebarNavItem(
    label: 'Finance',
    path: RouteNames.finance,
    icon: Icons.account_balance_outlined,
    selectedIcon: Icons.account_balance,
  );
  static const _payments = _SidebarNavItem(
    label: 'Payments',
    path: RouteNames.payments,
    icon: Icons.payments_outlined,
    selectedIcon: Icons.payments,
  );
  static const _settings = _SidebarNavItem(
    label: 'Settings',
    path: RouteNames.settings,
    icon: Icons.settings_outlined,
    selectedIcon: Icons.settings,
  );

  static const sections = <_SidebarNavSection>[
    _SidebarNavSection(title: 'OVERVIEW', items: [_dashboard]),
    _SidebarNavSection(
      title: 'OPERATIONS',
      items: [
        _products,
        _inventory,
        _warehouses,
        _sales,
        _purchasing,
        _suppliers,
        _customers,
      ],
    ),
    _SidebarNavSection(
      title: 'INSIGHTS',
      items: [_reports, _payments, _finance],
    ),
    _SidebarNavSection(title: 'SYSTEM', items: [_settings]),
  ];

  /// Returns true when [location] belongs to the nav item's route tree.
  static bool Function(String path) isActiveFor(String location) {
    return (String path) {
      if (location == path) return true;
      return location.startsWith('$path/');
    };
  }
}

// ──────────────────────────────────
// Widgets
// ──────────────────────────────────
class _SidebarHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: DesignTokens.primary,
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: const Icon(
              Icons.inventory_2,
              size: 20,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Expanded(
            child: Text(
              'StockFlow',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
            ),
          ),
        ],
      ),
    );
  }
}

class _SidebarSectionLabel extends StatelessWidget {
  final String title;

  const _SidebarSectionLabel({required this.title});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.sm,
        AppSpacing.sm,
        AppSpacing.sm,
        AppSpacing.xxs,
      ),
      child: Text(
        title,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

class _SidebarItem extends StatelessWidget {
  final _SidebarNavItem item;
  final bool selected;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = selected
        ? theme.colorScheme.primary
        : theme.colorScheme.onSurfaceVariant;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Material(
        color: selected
            ? theme.colorScheme.primaryContainer.withOpacity(0.45)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                Icon(
                  selected ? item.selectedIcon : item.icon,
                  size: AppSpacing.iconMd,
                  color: color,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    item.label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: color,
                      fontWeight:
                          selected ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarUserCard extends StatelessWidget {
  final String userName;
  final String email;
  final String initials;
  final VoidCallback onProfile;
  final VoidCallback onSettings;
  final VoidCallback onLogout;

  const _SidebarUserCard({
    required this.userName,
    required this.email,
    required this.initials,
    required this.onProfile,
    required this.onSettings,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.all(AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: DesignTokens.primary,
            child: Text(
              initials,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  userName,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  email,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: Icon(
              Icons.more_vert,
              size: AppSpacing.iconSm,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            onSelected: (value) {
              switch (value) {
                case 'profile':
                  onProfile();
                case 'settings':
                  onSettings();
                case 'logout':
                  onLogout();
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'profile', child: Text('Profile')),
              PopupMenuItem(value: 'settings', child: Text('Settings')),
              PopupMenuDivider(),
              PopupMenuItem(value: 'logout', child: Text('Logout')),
            ],
          ),
        ],
      ),
    );
  }
}
