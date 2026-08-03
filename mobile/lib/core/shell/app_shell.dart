import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_spacing.dart';
import 'app_sidebar.dart';
import 'app_top_bar.dart';

/// StockFlow responsive application shell.
///
/// Desktop (>= breakpointDesktop): persistent [AppSidebar] + [AppTopBar].
/// Mobile/tablet: drawer-based [AppSidebar] + [AppTopBar] with a menu button.
/// The routed [child] screen renders below the global chrome.
class AppShell extends ConsumerWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width >= AppSpacing.breakpointDesktop;
    final location = GoRouterState.of(context).uri.path;

    if (isDesktop) {
      return Scaffold(
        body: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSidebar(currentLocation: location),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppTopBar(currentLocation: location),
                  const Divider(height: 1),
                  Expanded(child: child),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      drawer: AppSidebar(currentLocation: location),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppTopBar(currentLocation: location, showMenuButton: true),
          const Divider(height: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}
