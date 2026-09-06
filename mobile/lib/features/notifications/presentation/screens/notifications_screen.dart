import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/loading_state_widget.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/notifications/domain/notification_models.dart';
import 'package:stockflow/features/notifications/presentation/providers/notifications_provider.dart';

/// Notifications screen — lists all notifications for the authenticated user.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() {
      ref.read(notificationsListProvider.notifier).loadNotifications();
      ref.read(unreadCountProvider.notifier).load();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(notificationsListProvider.notifier).loadMore();
    }
  }

  Future<void> _onRefresh() async {
    await ref.read(notificationsListProvider.notifier).refresh();
    await ref.read(unreadCountProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationsListProvider);

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.notifications,
            subtitle: context.l10n.notificationsSubtitle,
          ),
          Expanded(
            child: _buildBody(state),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(NotificationsListState state) {
    return switch (state) {
      NotificationsListLoading() => const LoadingStateWidget(),
      NotificationsListEmpty() => _buildEmpty(),
      NotificationsListError(:final message) => ErrorStateWidget(
          message: message,
          onRetry: () =>
              ref.read(notificationsListProvider.notifier).loadNotifications(),
        ),
      NotificationsListLoaded(:final items, :final hasMore, :final isLoadingMore) =>
        _buildList(items, hasMore, isLoadingMore),
    };
  }

  Widget _buildEmpty() {
    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.5,
            child: EmptyStateWidget(
              title: context.l10n.notificationsEmpty,
              subtitle: context.l10n.notificationsAllCaughtUp,
              icon: Icons.notifications_none_outlined,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(
      List<AppNotification> items, bool hasMore, bool isLoadingMore) {
    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: items.length + (isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= items.length) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _NotificationTile(
            notification: items[index],
            onTap: () => _onNotificationTap(items[index]),
          );
        },
      ),
    );
  }

  Future<void> _onNotificationTap(AppNotification notification) async {
    if (!notification.isRead) {
      await ref
          .read(notificationsListProvider.notifier)
          .markRead(notification.id);
    }

    if (!mounted) return;

    // Navigate to entity if a safe route exists
    if (notification.entityType != null && notification.entityId != null) {
      final route = _routeForEntity(notification.entityType!);
      if (route != null) {
        context.push(route.replaceAll(':id', notification.entityId!));
      }
    }
  }

  /// Only navigate to entities with existing safe routes.
  String? _routeForEntity(String entityType) {
    switch (entityType) {
      case 'PurchaseOrder':
        return '/purchasing/:id';
      case 'Product':
        return '/products/:id';
      default:
        return null; // Unknown entity — stay on notifications screen
    }
  }
}

// ──────────────────────────────────
// Notification Tile
// ──────────────────────────────────
class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final isUnread = !notification.isRead;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      color: isUnread
          ? theme.colorScheme.primaryContainer.withOpacity(0.08)
          : null,
      child: ListTile(
        onTap: onTap,
        leading: _NotificationIcon(type: notification.type),
        title: Text(
          _resolveTitle(notification, l10n),
          style: TextStyle(
            fontWeight: isUnread ? FontWeight.w600 : FontWeight.normal,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          _resolveBody(notification, l10n),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodySmall,
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              _timeAgo(notification.createdAt, l10n),
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (isUnread) ...[
              const SizedBox(height: 4),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: DesignTokens.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
      ),
    );
  }

  /// Resolve localized title from titleKey + params.
  String _resolveTitle(AppNotification n, AppLocalizations l10n) {
    switch (n.type) {
      case 'LOW_STOCK':
        return l10n.notificationTypeLowStockTitle;
      case 'SUPPLIER_PAYMENT_OVERDUE':
        return l10n.notificationTypeSupplierPaymentOverdueTitle;
      case 'PURCHASE_ORDER_STATUS_CHANGED':
        return l10n.notificationTypePurchaseOrderStatusTitle;
      default:
        return n.titleKey; // Fallback to raw key
    }
  }

  /// Resolve localized body from bodyKey + params.
  String _resolveBody(AppNotification n, AppLocalizations l10n) {
    final params = n.params ?? {};
    switch (n.type) {
      case 'LOW_STOCK':
        final productName = params['productName'] ?? '';
        final quantity = params['quantity'] ?? '';
        return l10n.notificationTypeLowStockBody(productName, quantity);
      case 'SUPPLIER_PAYMENT_OVERDUE':
        final supplierName = params['supplierName'] ?? '';
        final daysOverdue = params['daysOverdue'] ?? '';
        return l10n.notificationTypeSupplierPaymentOverdueBody(
            supplierName, daysOverdue);
      case 'PURCHASE_ORDER_STATUS_CHANGED':
        final orderNumber = params['orderNumber'] ?? '';
        final newStatus = params['newStatus'] ?? '';
        return l10n.notificationTypePurchaseOrderStatusBody(
            orderNumber, newStatus);
      default:
        return n.bodyKey ?? ''; // Fallback
    }
  }

  /// Simple relative time display.
  String _timeAgo(String isoDate, AppLocalizations l10n) {
    final date = DateTime.tryParse(isoDate);
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return l10n.timeJustNow;
    if (diff.inMinutes < 60) return l10n.timeMinutesAgo(diff.inMinutes);
    if (diff.inHours < 24) return l10n.timeHoursAgo(diff.inHours);
    if (diff.inDays < 7) return l10n.timeDaysAgo(diff.inDays);
    return '${date.day}/${date.month}/${date.year}';
  }
}

// ──────────────────────────────────
// Notification Icon by Type
// ──────────────────────────────────
class _NotificationIcon extends StatelessWidget {
  final String type;

  const _NotificationIcon({required this.type});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final (icon, color) = switch (type) {
      'LOW_STOCK' => (
          Icons.inventory_2_outlined,
          DesignTokens.warning,
        ),
      'SUPPLIER_PAYMENT_OVERDUE' => (
          Icons.payment_outlined,
          theme.colorScheme.error,
        ),
      'PURCHASE_ORDER_STATUS_CHANGED' => (
          Icons.receipt_long_outlined,
          DesignTokens.success,
        ),
      _ => (
          Icons.notifications_outlined,
          theme.colorScheme.onSurfaceVariant,
        ),
    };

    return CircleAvatar(
      radius: 20,
      backgroundColor: color.withOpacity(0.12),
      child: Icon(icon, size: 20, color: color),
    );
  }
}
