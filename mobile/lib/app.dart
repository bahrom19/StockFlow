import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/currency/currency_ext.dart';
import 'core/currency/currency_provider.dart';
import 'core/localization/l10n_ext.dart';
import 'core/localization/locale_provider.dart';
import 'core/navigation/app_router.dart';
import 'core/outbox/outbox_indicator.dart';
import 'core/outbox/outbox_sync_service.dart';
import 'core/services/connectivity_service.dart';
import 'core/theme/app_spacing.dart';
import 'core/theme/app_theme.dart';
import 'features/customers/presentation/providers/customers_provider.dart';
import 'features/dashboard/presentation/providers/dashboard_provider.dart';
import 'features/inventory/presentation/providers/inventory_provider.dart';
import 'features/products/presentation/providers/products_provider.dart';
import 'features/sales/presentation/providers/cash_shift_provider.dart';
import 'features/sales/presentation/providers/sales_provider.dart';

/// Guarded, debounced concurrent refresh of the core data providers.
///
/// Runs at most one batch at a time ([_inFlight]) and at most one batch per
/// [minInterval] window. A single OFFLINE→ONLINE transition or a single app
/// resume therefore produces exactly ONE burst of requests; events repeated
/// inside the window are dropped (never queued) — no request storm and no
/// refresh→rebuild→refresh cycle is possible.
class CoreDataRefresher {
  CoreDataRefresher(
    this._tasks, {
    this.minInterval = const Duration(milliseconds: 1500),
    DateTime Function()? now,
  })  : _now = now ?? DateTime.now,
        _lastRunAt = DateTime.fromMillisecondsSinceEpoch(0);

  final List<Future<void> Function()> _tasks;
  final Duration minInterval;

  /// Injectable clock so tests can verify the debounce window deterministically.
  final DateTime Function() _now;

  bool _inFlight = false;
  DateTime _lastRunAt;

  /// Starts a refresh batch unless one is already in flight or the previous
  /// batch started less than [minInterval] ago. Returns true when started.
  bool run() {
    if (_inFlight) return false;
    final now = _now();
    if (now.difference(_lastRunAt) < minInterval) return false;
    _inFlight = true;
    _lastRunAt = now;
    unawaited(
      Future.wait<void>(_tasks.map(_runGuarded))
          .whenComplete(() => _inFlight = false),
    );
    return true;
  }

  /// One failing refresh (e.g. the network dropped again mid-flight) must
  /// never break the others — errors are swallowed on purpose.
  Future<void> _runGuarded(Future<void> Function() task) async {
    try {
      await task();
    } catch (_) {}
  }
}

/// Refresh tasks executed on app resume (when ONLINE) and on the
/// OFFLINE→ONLINE transition — the minimal safe data set: dashboard,
/// cash shift, products, inventory, customers. Each task is a fire-and-forget
/// network refresh of a keep-alive provider. A provider-level provider so
/// tests can override it with counting fakes instead of real requests.
final coreDataRefreshProvider = Provider<List<Future<void> Function()>>((ref) {
  return [
    () => ref.read(dashboardProvider.notifier).refresh(),
    () => ref.read(cashShiftProvider.notifier).refresh(),
    () => ref.read(productsListProvider.notifier).refresh(),
    () => ref.read(inventoryListProvider.notifier).refresh(),
    () => ref.read(customersListProvider.notifier).refresh(),
    // Offline 1B-min: flush the durable outbox queue in the same debounced
    // burst (the worker's other trigger is the manual Retry action in the
    // outbox indicator). Fire-and-forget like the tasks above — failures are
    // mapped to PENDING / FAILED_PERMANENT inside the worker itself.
    () async {
      await ref.read(outboxSyncProvider).syncAll();
    },
  ];
});

/// StockFlow Enterprise Application Widget
class StockFlowApp extends ConsumerStatefulWidget {
  const StockFlowApp({super.key});

  @override
  ConsumerState<StockFlowApp> createState() => _StockFlowAppState();
}

class _StockFlowAppState extends ConsumerState<StockFlowApp>
    with WidgetsBindingObserver {
  late final CoreDataRefresher _refresher =
      CoreDataRefresher(ref.read(coreDataRefreshProvider));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    // Resume: refresh the core data only when actually ONLINE. When OFFLINE
    // — never send anything to the server, the snapshot just stays as it is.
    if (ref.read(connectivityStatusProvider)) {
      _refresher.run();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    // Phase 0: wired locale defaults to English — system ru/kk is NOT
    // auto-activated; the owner switches explicitly in Settings.
    final appLocale = ref.watch(localeProvider);
    // Phase 4: selected currency (default KZT). Rebuilding this scope on
    // change re-renders every `context.money` consumer reactively.
    final currencyCode = ref.watch(currencyProvider);
    // Keep the POS cart currency in lock-step with the provider — the sole
    // source of truth. Riverpod removes this listener automatically on rebuild.
    ref.listen<String>(currencyProvider, (prev, next) {
      ref.read(cartProvider.notifier).syncFromCurrency();
    });
    // React ONLY to a real OFFLINE → ONLINE transition. The very first status
    // event (prev == null, e.g. app start) is intentionally ignored so that
    // launching the app never triggers a refresh burst.
    ref.listen<bool>(connectivityStatusProvider, (prev, next) {
      if (prev == false && next) {
        _refresher.run();
      }
    });

    return CurrencyScope(
      code: currencyCode,
      child: MaterialApp.router(
        title: 'StockFlow',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        routerConfig: router,
        locale: appLocale,
        // Localization support
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [
          Locale('en', 'US'),
          Locale('ru', 'RU'),
          Locale('kk', 'KZ'),
        ],
        localeResolutionCallback: (locale, supportedLocales) {
          for (final supported in supportedLocales) {
            if (supported.languageCode == locale?.languageCode) {
              return supported;
            }
          }
          return const Locale('en', 'US');
        },
        // Global offline indicator above every routed screen.
        builder: (context, child) => OfflineBannerScope(
          // Offline 1B-min: the outbox bar renders below the offline banner
          // and above the routed content whenever sales are queued.
          child: OutboxIndicatorScope(child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }
}

/// Shows the compact offline banner above the routed content while the device
/// is OFFLINE and removes it when connectivity is restored. Navigation and
/// the content below stay fully interactive.
///
/// NOTE: this only communicates the network state. Offline-1A does NOT add
/// offline capabilities — mutations may still fail without a connection.
class OfflineBannerScope extends ConsumerWidget {
  const OfflineBannerScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityStatusProvider);
    if (isOnline) return child;
    return Column(
      children: [
        const _OfflineBanner(),
        Expanded(child: child),
      ],
    );
  }
}

/// Compact offline indicator. Deliberately uses the neutral existing
/// `noInternetTitle` localization — the app does NOT claim offline support.
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.errorContainer,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          child: Row(
            children: [
              Icon(
                Icons.wifi_off,
                size: 16,
                color: theme.colorScheme.onErrorContainer,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  context.l10n.noInternetTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.onErrorContainer,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
