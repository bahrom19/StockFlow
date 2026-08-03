import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_state.dart';
import '../auth/models/auth_models.dart';
import '../navigation/route_names.dart';
import '../theme/app_spacing.dart';
import '../theme/design_tokens.dart';

/// StockFlow global top bar.
///
/// Shows the current page title (derived from the active route), a live
/// search field that deep-links to the matching module, notifications and
/// a user menu (Profile / Settings / Logout).
class AppTopBar extends ConsumerWidget {
  final String currentLocation;
  final bool showMenuButton;

  const AppTopBar({
    super.key,
    required this.currentLocation,
    this.showMenuButton = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(currentUserProvider);
    final title = _titleForLocation(currentLocation);

    return Material(
      color: theme.colorScheme.surface,
      elevation: 0,
      child: Container(
        height: AppSpacing.appBarHeight,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        child: Row(
          children: [
            if (showMenuButton) ...[
              IconButton(
                icon: const Icon(Icons.menu),
                tooltip: 'Menu',
                onPressed: () => Scaffold.of(context).openDrawer(),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
            Expanded(
              child: Text(
                title,
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            // Global search — deep-links to the module where the term lives.
            _GlobalSearchField(currentLocation: currentLocation),
            const SizedBox(width: AppSpacing.sm),
            IconButton(
              icon: const Icon(Icons.notifications_outlined),
              tooltip: 'Notifications',
              onPressed: () {},
            ),
            const SizedBox(width: AppSpacing.xs),
            _UserMenu(
              userName: user?.fullName ?? 'User',
              email: user?.email ?? '',
              initials: _initials(user?.fullName ?? 'U'),
              onProfile: () => context.go(RouteNames.profile),
              onSettings: () => context.go(RouteNames.settings),
              onLogout: () => ref.read(authStateProvider.notifier).logout(),
            ),
          ],
        ),
      ),
    );
  }

  String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'U';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  String _titleForLocation(String location) {
    if (location.startsWith(RouteNames.sales)) return 'Sales';
    if (location.startsWith(RouteNames.inventory)) return 'Inventory';
    if (location.startsWith(RouteNames.products)) return 'Products';
    if (location.startsWith(RouteNames.purchasing)) return 'Purchasing';
    if (location.startsWith(RouteNames.suppliers)) return 'Suppliers';
    if (location.startsWith(RouteNames.customers)) return 'Customers';
    if (location.startsWith(RouteNames.reports)) return 'Reports';
    if (location.startsWith(RouteNames.finance)) return 'Finance';
    if (location.startsWith(RouteNames.profile)) return 'Profile';
    if (location.startsWith(RouteNames.settings)) return 'Settings';
    return 'Dashboard';
  }
}

/// Search field that navigates to the module containing the search term.
/// Products / Inventory / Suppliers / Sales searches deep-link to their
/// list screens (which already expose a search box).
class _GlobalSearchField extends StatefulWidget {
  final String currentLocation;

  const _GlobalSearchField({required this.currentLocation});

  @override
  State<_GlobalSearchField> createState() => _GlobalSearchFieldState();
}

class _GlobalSearchFieldState extends State<_GlobalSearchField> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >=
        AppSpacing.breakpointTablet;
    if (!isDesktop) return const SizedBox.shrink();

    return SizedBox(
      width: 280,
      child: TextField(
        controller: _controller,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search…',
          prefixIcon: const Icon(Icons.search, size: 20),
          isDense: true,
          filled: true,
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            borderSide: BorderSide.none,
          ),
        ),
        onSubmitted: (value) {
          final term = value.trim();
          if (term.isEmpty) return;
          _controller.clear();
          // Route to the module best matching the search intent.
          context.go(_routeForSearch(term));
        },
      ),
    );
  }

  String _routeForSearch(String term) {
    final lowered = term.toLowerCase();
    if (lowered.contains('sale') || lowered.contains('pos')) {
      return RouteNames.sales;
    }
    if (lowered.contains('order') || lowered.contains('purchase')) {
      return RouteNames.purchasing;
    }
    if (lowered.contains('supplier')) return RouteNames.suppliers;
    if (lowered.contains('stock') || lowered.contains('warehouse')) {
      return RouteNames.inventory;
    }
    return RouteNames.products;
  }
}

class _UserMenu extends StatelessWidget {
  final String userName;
  final String email;
  final String initials;
  final VoidCallback onProfile;
  final VoidCallback onSettings;
  final VoidCallback onLogout;

  const _UserMenu({
    required this.userName,
    required this.email,
    required this.initials,
    required this.onProfile,
    required this.onSettings,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Account',
      offset: const Offset(0, 48),
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: DesignTokens.primary,
            child: Text(
              initials,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Icon(
            Icons.arrow_drop_down,
            size: 20,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ],
      ),
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'profile',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(userName,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              if (email.isNotEmpty)
                Text(
                  email,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'profile',
          child: Row(
            children: [
              Icon(Icons.person_outline, size: 18),
              SizedBox(width: 8),
              Text('Profile'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'settings',
          child: Row(
            children: [
              Icon(Icons.settings_outlined, size: 18),
              SizedBox(width: 8),
              Text('Settings'),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'logout',
          child: Row(
            children: [
              Icon(Icons.logout, size: 18),
              SizedBox(width: 8),
              Text('Logout'),
            ],
          ),
        ),
      ],
    );
  }
}
