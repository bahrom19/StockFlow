import 'package:flutter/material.dart';
import '../localization/l10n_ext.dart';
import 'error_state_widget.dart';
import 'empty_state_widget.dart';
import 'loading_state_widget.dart';
import 'offline_state_widget.dart';

/// Async State Handler Widget
/// Wraps content with loading, error, empty, and offline states.
class AppScaffold extends StatelessWidget {
  final Widget child;
  final bool isLoading;
  final String? loadingMessage;
  final bool isOffline;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final bool isEmpty;
  final String? emptyTitle;
  final String? emptySubtitle;
  final IconData? emptyIcon;
  final String? emptyActionLabel;
  final VoidCallback? onEmptyAction;

  const AppScaffold({
    super.key,
    required this.child,
    this.isLoading = false,
    this.loadingMessage,
    this.isOffline = false,
    this.errorMessage,
    this.onRetry,
    this.isEmpty = false,
    this.emptyTitle,
    this.emptySubtitle,
    this.emptyIcon,
    this.emptyActionLabel,
    this.onEmptyAction,
  });

  @override
  Widget build(BuildContext context) {
    if (isOffline) {
      return OfflineStateWidget(onRetry: onRetry);
    }
    if (isLoading) {
      return LoadingStateWidget(message: loadingMessage);
    }
    if (errorMessage != null) {
      return ErrorStateWidget(message: errorMessage!, onRetry: onRetry);
    }
    if (isEmpty) {
      return EmptyStateWidget(
        title: emptyTitle ?? context.l10n.noData,
        subtitle: emptySubtitle,
        icon: emptyIcon ?? Icons.inbox_outlined,
        actionLabel: emptyActionLabel,
        onAction: onEmptyAction,
      );
    }
    return child;
  }
}
