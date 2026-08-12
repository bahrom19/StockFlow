import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_state.dart';
import '../auth/models/auth_models.dart';
import '../localization/l10n_ext.dart';
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
                for (final section in _SidebarNav.sections(context.l10n)) ...[
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
            userName: user?.fullName ?? context.l10n.user,
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
  /// Navigation sections with labels resolved from [l10n] at build time —
  /// the labels are display-only; routing stays on the raw path constants.
  static List<_SidebarNavSection> sections(AppLocalizations l10n) => [
        _SidebarNavSection(
          title: l10n.navSectionOverview,
          items: [
            _SidebarNavItem(
              label: l10n.dashboard,
              path: RouteNames.dashboard,
              icon: Icons.dashboard_outlined,
              selectedIcon: Icons.dashboard,
            ),
          ],
        ),
        _SidebarNavSection(
          title: l10n.navSectionOperations,
          items: [
            _SidebarNavItem(
              label: l10n.products,
              path: RouteNames.products,
              icon: Icons.inventory_2_outlined,
              selectedIcon: Icons.inventory_2,
            ),
            _SidebarNavItem(
              label: l10n.inventory,
              path: RouteNames.inventory,
              icon: Icons.inventory_outlined,
              selectedIcon: Icons.inventory,
            ),
            _SidebarNavItem(
              label: l10n.warehouses,
              path: RouteNames.warehouses,
              icon: Icons.warehouse_outlined,
              selectedIcon: Icons.warehouse,
            ),
            _SidebarNavItem(
              label: l10n.sales,
              path: RouteNames.sales,
              icon: Icons.receipt_long_outlined,
              selectedIcon: Icons.receipt_long,
            ),
            _SidebarNavItem(
              label: l10n.purchasing,
              path: RouteNames.purchasing,
              icon: Icons.shopping_cart_outlined,
              selectedIcon: Icons.shopping_cart,
            ),
            _SidebarNavItem(
              label: l10n.suppliers,
              path: RouteNames.suppliers,
              icon: Icons.local_shipping_outlined,
              selectedIcon: Icons.local_shipping,
            ),
            _SidebarNavItem(
              label: l10n.customers,
              path: RouteNames.customers,
              icon: Icons.people_outline,
              selectedIcon: Icons.people,
            ),
          ],
        ),
        _SidebarNavSection(
          title: l10n.navSectionInsights,
          items: [
            _SidebarNavItem(
              label: l10n.reports,
              path: RouteNames.reports,
              icon: Icons.bar_chart_outlined,
              selectedIcon: Icons.bar_chart,
            ),
            _SidebarNavItem(
              label: l10n.payments,
              path: RouteNames.payments,
              icon: Icons.payments_outlined,
              selectedIcon: Icons.payments,
            ),
            _SidebarNavItem(
              label: l10n.finance,
              path: RouteNames.finance,
              icon: Icons.account_balance_outlined,
              selectedIcon: Icons.account_balance,
            ),
          ],
        ),
        _SidebarNavSection(
          title: l10n.navSectionSystem,
          items: [
            _SidebarNavItem(
              label: l10n.settings,
              path: RouteNames.settings,
              icon: Icons.settings_outlined,
              selectedIcon: Icons.settings,
            ),
          ],
        ),
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

class _SidebarItem extends StatefulWidget {
  final _SidebarNavItem item;
  final bool selected;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  @override
  State<_SidebarItem> createState() => _SidebarItemState();
}

class _SidebarItemState extends State<_SidebarItem> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = widget.selected
        ? theme.colorScheme.primary
        : theme.colorScheme.onSurfaceVariant;
    final bg = widget.selected
        ? theme.colorScheme.primaryContainer.withOpacity(0.45)
        : (_hovered
            ? theme.colorScheme.onSurface.withOpacity(0.05)
            : Colors.transparent);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              onTap: widget.onTap,
              child: Stack(
                children: [
                  // Active indicator bar (left edge)
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    left: 0,
                    top: widget.selected ? 8 : 14,
                    bottom: widget.selected ? 8 : 14,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 200),
                      opacity: widget.selected ? 1 : 0,
                      child: Container(
                        width: 3,
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(
                      left: AppSpacing.sm + 3,
                      right: AppSpacing.sm,
                      top: AppSpacing.sm,
                      bottom: AppSpacing.sm,
                    ),
                    child: Row(
                      children: [
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 180),
                          child: Icon(
                            widget.selected
                                ? widget.item.selectedIcon
                                : widget.item.icon,
                            key: ValueKey(widget.selected),
                            size: AppSpacing.iconMd,
                            color: color,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            widget.item.label,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: color,
                              fontWeight: widget.selected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
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
    return MouseRegion(
      cursor: SystemMouseCursors.basic,
      child: Container(
        margin: const EdgeInsets.all(AppSpacing.sm),
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withOpacity(0.6),
          ),
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
            Semantics(
              label: context.l10n.accountMenu,
              button: true,
              child: PopupMenuButton<String>(
                icon: Icon(
                  Icons.more_vert,
                  size: AppSpacing.iconSm,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                tooltip: context.l10n.accountMenu,
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
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'profile',
                    child: Text(context.l10n.profile),
                  ),
                  PopupMenuItem(
                    value: 'settings',
                    child: Text(context.l10n.settings),
                  ),
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: 'logout',
                    child: Text(context.l10n.logout),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
