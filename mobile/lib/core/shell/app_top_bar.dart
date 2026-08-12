import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/sales/presentation/providers/cash_shift_provider.dart';
import '../auth/auth_state.dart';
import '../auth/models/auth_models.dart';
import '../localization/l10n_ext.dart';
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
    final title = _titleForLocation(context.l10n, currentLocation);

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
                tooltip: context.l10n.menu,
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
            // Live system status: pulse dot + clock + open-shift pill.
            // Passive — watches providers, never triggers requests.
            const _LiveStatusCluster(),
            const SizedBox(width: AppSpacing.xs),
            IconButton(
              tooltip: context.l10n.notifications,
              onPressed: () {
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(
                      content: Row(
                        children: [
                          const Icon(Icons.notifications_none, size: 18),
                          const SizedBox(width: 8),
                          Expanded(child: Text(context.l10n.notificationsAllCaughtUp)),
                        ],
                      ),
                      behavior: SnackBarBehavior.floating,
                      width: 320,
                    ),
                  );
              },
              icon: const Icon(Icons.notifications_outlined),
            ),
            const SizedBox(width: AppSpacing.xs),
            _UserMenu(
              userName: user?.fullName ?? context.l10n.user,
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

  String _titleForLocation(AppLocalizations l10n, String location) {
    if (location.startsWith(RouteNames.sales)) return l10n.sales;
    if (location.startsWith(RouteNames.inventory)) return l10n.inventory;
    if (location.startsWith(RouteNames.products)) return l10n.products;
    if (location.startsWith(RouteNames.purchasing)) return l10n.purchasing;
    if (location.startsWith(RouteNames.suppliers)) return l10n.suppliers;
    if (location.startsWith(RouteNames.customers)) return l10n.customers;
    if (location.startsWith(RouteNames.reports)) return l10n.reports;
    if (location.startsWith(RouteNames.finance)) return l10n.finance;
    if (location.startsWith(RouteNames.profile)) return l10n.profile;
    if (location.startsWith(RouteNames.settings)) return l10n.settings;
    return l10n.dashboard;
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
    // Keep the top bar breathable on small desktops: the 280px global search
    // only fits when there is real horizontal room left after the sidebar,
    // live-status cluster and user menu.
    final isDesktop = MediaQuery.of(context).size.width >=
        AppSpacing.breakpointDesktop;
    if (!isDesktop) return const SizedBox.shrink();

    return SizedBox(
      width: 280,
      child: TextField(
        controller: _controller,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: context.l10n.searchHint,
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

/// Live system status cluster — pulse dot + current time + open-shift pill.
///
/// Passive by design: watches [cashShiftProvider] but never calls a notifier
/// (no new API requests from the global chrome). When the shift state is
/// unknown/loading a neutral placeholder renders instead.
class _LiveStatusCluster extends ConsumerStatefulWidget {
  const _LiveStatusCluster();

  @override
  ConsumerState<_LiveStatusCluster> createState() => _LiveStatusClusterState();
}

class _LiveStatusClusterState extends ConsumerState<_LiveStatusCluster> {
  Timer? _timer;
  late String _time;

  @override
  void initState() {
    super.initState();
    _time = _now();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _time = _now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _now() {
    final n = DateTime.now();
    final hh = n.hour.toString().padLeft(2, '0');
    final mm = n.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shiftState = ref.watch(cashShiftProvider);

    String shiftLabel;
    Color shiftColor;
    switch (shiftState) {
      case ShiftLoaded(:final current):
        if (current == null) {
          shiftLabel = context.l10n.shiftNoShift;
          shiftColor = DesignTokens.warning;
        } else {
          shiftLabel = context.l10n.shiftOpen;
          shiftColor = DesignTokens.success;
        }
      case ShiftError():
        shiftLabel = context.l10n.shiftUnknown;
        shiftColor = theme.colorScheme.onSurfaceVariant;
      default:
        // Loading / unknown → graceful placeholder.
        shiftLabel = context.l10n.shiftUnknown;
        shiftColor = theme.colorScheme.onSurfaceVariant;
    }

    return Semantics(
      label: context.l10n.systemLiveStatus(shiftLabel, _time),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Pulse dot + Live
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: DesignTokens.success.withOpacity(0.10),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _PulseDot(),
                const SizedBox(width: 5),
                Text(
                  context.l10n.liveStatus(_time),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: DesignTokens.success,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          // Shift pill
          Tooltip(
            message: context.l10n.cashShiftStatus,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: shiftColor.withOpacity(0.10),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.point_of_sale, size: 12, color: shiftColor),
                  const SizedBox(width: 4),
                  Text(
                    shiftLabel,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: shiftColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Softly pulsing green dot — the "alive" heartbeat of the system.
class _PulseDot extends StatefulWidget {
  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 1.0, end: 0.35).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      ),
      child: Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(
          color: DesignTokens.success,
          shape: BoxShape.circle,
        ),
      ),
    );
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
    return Semantics(
      label: context.l10n.accountMenu,
      button: true,
      child: PopupMenuButton<String>(
      tooltip: context.l10n.accountMenu,
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
        PopupMenuItem(
          value: 'profile',
          child: Row(
            children: [
              const Icon(Icons.person_outline, size: 18),
              const SizedBox(width: 8),
              Text(context.l10n.profile),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'settings',
          child: Row(
            children: [
              const Icon(Icons.settings_outlined, size: 18),
              const SizedBox(width: 8),
              Text(context.l10n.settings),
            ],
          ),
        ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'logout',
          child: Row(
            children: [
              const Icon(Icons.logout, size: 18),
              const SizedBox(width: 8),
              Text(context.l10n.logout),
            ],
          ),
        ),
      ],
      ),
    );
  }
}
