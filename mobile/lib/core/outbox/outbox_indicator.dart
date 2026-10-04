import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_scheduler.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';

/// Compact outbox bar above the routed content (Offline 1B-min).
///
/// Visible whenever offline operations are queued — sales as well as cash,
/// inventory and purchasing mutations — as "N pending changes" plus, for
/// FAILED_PERMANENT entries, an error entry point with per-entry Retry /
/// Discard. "Send now" runs one worker burst immediately. Watching
/// [outboxInitProvider] also hydrates the persisted queue once on cold start.
class OutboxIndicatorScope extends ConsumerWidget {
  const OutboxIndicatorScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Fire-and-forget hydrate of the persisted queue (restart survival).
    ref.watch(outboxInitProvider);
    // Arms the F5-C retry scheduler for the whole app: one initial flush of
    // the hydrated backlog plus automatic backoff retries (fire-and-forget,
    // no UI impact).
    ref.watch(outboxSchedulerProvider);
    final state = ref.watch(outboxControllerProvider);
    // G16-N-3 P2-B-4 Phase 1 (F2): every count and every rendered entry is
    // scoped to the AUTHENTICATED identity (companyId + userId). On a shared
    // till the persisted queue may hold another user's operations; a global
    // count would disclose their existence, and the failed-ops dialog would
    // disclose their payload. Unauthenticated => nothing is this user's to
    // see, so the bar is suppressed entirely.
    final user = ref.watch(currentUserProvider);
    if (user == null) return child;
    final companyId = user.companyId;
    final userId = user.id;
    // Scope-local emptiness, NOT `state.isEmpty`: a queue holding only
    // foreign-scope operations must render as "no outbox activity" for this
    // user rather than advertising another account's backlog.
    if (state.unresolvedFor(companyId, userId).isEmpty) return child;

    final l10n = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final pending = state.pendingCountFor(companyId, userId) +
        state.sendingCountFor(companyId, userId);
    final failed = state.failedCountFor(companyId, userId);
    // True while the worker is actively flushing entries (F5-C wiring drives
    // the same controller state). The UI disables the manual "Send now" tap
    // during that window so repeated taps cannot stack burst attempts.
    final isSending = state.sendingCountFor(companyId, userId) > 0;
    // G16-N-3 P2-B-4 Phase 2: persistent queue pressure. Scoped exactly like
    // every other number on this bar, so a foreign account's backlog can
    // neither be counted here nor be inferred from its presence. This is a
    // WARNING surface only — enqueue is not gated at the soft cap.
    final capacityUsed = state.capacityUsedFor(companyId, userId);
    final underPressure = capacityUsed >= OutboxController.softCapacityLimit;
    final pendingLabel = l10n.outboxPendingItems(pending);
    final failedLabel = failed > 0 ? l10n.outboxFailedItems(failed) : null;
    final pressureLabel =
        underPressure ? l10n.outboxQueuePressure(capacityUsed) : null;
    final segments = <String>[
      pendingLabel,
      if (failedLabel != null) failedLabel,
      if (pressureLabel != null) pressureLabel,
    ].join('  •  ');
    final label = segments;
    // Screen-reader label for the whole compact bar: the same localized,
    // generic wording the visible text shows. No new ARB keys.
    final barLabel = '$segments.';

    return Column(
      children: [
        Semantics(
          container: true,
          label: barLabel,
          child: Material(
            color: theme.colorScheme.secondaryContainer,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      Icons.cloud_upload_outlined,
                      size: 18,
                      color: theme.colorScheme.onSecondaryContainer,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSecondaryContainer,
                        ),
                      ),
                    ),
                    if (isSending)
                      const Padding(
                        padding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else
                      TextButton(
                        onPressed: () => ref.read(outboxSyncProvider).syncAll(),
                        child: Text(l10n.outboxSyncNow),
                      ),
                    if (failed > 0)
                      IconButton(
                        tooltip: l10n.outboxFailedTitle,
                        icon: const Icon(Icons.error_outline, size: 20),
                        onPressed: () => _showFailedDialog(
                          context,
                          ref,
                          l10n,
                          companyId,
                          userId,
                          ref.read(outboxSchedulerClockProvider),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        Expanded(child: child),
      ],
    );
  }

  /// User-facing title of a failed entry: the sale number for sales, a
  /// localized kind label for every other kind. The raw clientOperationId
  /// (UUID) stays only as a last-resort technical fallback for a sale whose
  /// payload has no saleNumber.
  static String _failedItemTitle(OutboxOperation op, AppLocalizations l10n) {
    switch (op.kind) {
      case OutboxOperationKind.createSale:
        return '${op.payload['saleNumber'] ?? op.clientOperationId}';
      case OutboxOperationKind.cashIn:
        return l10n.outboxKindCashIn;
      case OutboxOperationKind.cashOut:
        return l10n.outboxKindCashOut;
      case OutboxOperationKind.adjustStock:
        return l10n.outboxKindAdjustStock;
      case OutboxOperationKind.transferStock:
        return l10n.outboxKindTransferStock;
      case OutboxOperationKind.goodsReceipt:
        return l10n.outboxKindGoodsReceipt;
    }
  }

  /// Localized, human-readable age of one queued operation.
  ///
  /// Display only (G16-N-3 P2-B-4 Phase 0 / F4). A `null` [OutboxOperationAge]
  /// means the operation carries no `createdAt` — a legacy v1 entry — and is
  /// rendered as an explicit "age unknown" rather than a fabricated value.
  static String _ageLabel(
    OutboxOperation op,
    DateTime now,
    AppLocalizations l10n,
  ) {
    final age = op.ageAt(now);
    if (age == null) return l10n.outboxOperationAgeUnknown;
    switch (age.unit) {
      case OutboxOperationAgeUnit.minutes:
        return l10n.outboxOperationAgeMinutes(age.value);
      case OutboxOperationAgeUnit.hours:
        return l10n.outboxOperationAgeHours(age.value);
      case OutboxOperationAgeUnit.days:
        return l10n.outboxOperationAgeDays(age.value);
    }
  }

  void _showFailedDialog(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
    String companyId,
    String userId,
    DateTime Function() clock,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        // Reactive: the open dialog follows the live queue, so a Retry or
        // Discard performed inside it removes the entry immediately (no
        // reopen needed). A repeated tap on an already-resolved entry is a
        // safe controller no-op.
        return Consumer(
          builder: (context, dialogRef, _) {
            // G16-N-3 P2-B-4 Phase 1 (F2): scope filter is applied BEFORE the
            // list is built, so `_failedItemTitle` can never be reached with a
            // foreign operation and no payload field (saleNumber, kind,
            // lastError) of another user/company can be rendered. This is the
            // mandatory precondition for Phase 3, where same-scope operations
            // survive logout and foreign-scope ones remain in storage.
            //
            // The clock comes from the outbox clock provider rather than
            // DateTime.now() so the rendered age is deterministic under test.
            final now = clock();
            final ops = dialogRef
                .watch(outboxControllerProvider)
                .unresolvedFor(companyId, userId)
                .where((o) => o.status == OutboxStatus.failedPermanent)
                .toList(growable: false);
            return AlertDialog(
              title: Text(l10n.outboxFailedTitle),
              content: SizedBox(
                width: 460,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: ops.length,
                  itemBuilder: (_, index) {
                    final op = ops[index];
                    return ListTile(
                      dense: true,
                      title: Text(
                        _failedItemTitle(op, l10n),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      // Error and age are SEPARATE Text widgets rather than one joined
                      // string: the existing subtitle contract (the raw
                      // lastError is findable on its own) is preserved, and a
                      // screen reader announces the failure reason before the
                      // age.
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (op.lastError != null)
                            Text(
                              op.lastError!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          Text(
                            _ageLabel(op, now, l10n),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: l10n.retry,
                            icon: const Icon(Icons.refresh),
                            onPressed: () async {
                              // G16-N-3 P2-B-4 Phase 0 (F1/F4): a stale
                              // operation asks for ONE extra confirmation.
                              // This is purely cosmetic — it never blocks the
                              // retry, never mutates the operation and never
                              // changes the outcome, because durable operation
                              // identity makes a replay safe at any age.
                              // Cancelling leaves the entry untouched.
                              if (op.isStaleAt(now)) {
                                final proceed = await _confirmStaleRetry(
                                  dialogContext,
                                  l10n,
                                );
                                if (proceed != true) return;
                              }
                              final controller = dialogRef.read(
                                outboxControllerProvider.notifier,
                              );
                              // retryFailed() preserves clientOperationId,
                              // idempotencyKey, payload and createdAt
                              // verbatim — unchanged in Phase 0/1.
                              await controller.retryFailed(
                                op.clientOperationId,
                              );
                              await dialogRef
                                  .read(outboxSyncProvider)
                                  .syncAll();
                            },
                          ),
                          IconButton(
                            tooltip: l10n.outboxDiscard,
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () async {
                              final controller = dialogRef.read(
                                outboxControllerProvider.notifier,
                              );
                              await controller.discard(op.clientOperationId);
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: Text(l10n.goBack),
                ),
              ],
            );
          },
        );
      },
    );
  }

  /// Confirmation shown before re-sending an operation that is at least
  /// [OutboxOperationAge.staleAfterDays] old. Returns true only on an explicit
  /// Retry; `null` (dismissed) and false (Cancel) both abort without touching
  /// the operation.
  Future<bool?> _confirmStaleRetry(
    BuildContext context,
    AppLocalizations l10n,
  ) {
    return showDialog<bool>(
      context: context,
      builder: (confirmContext) => AlertDialog(
        title: Text(l10n.outboxStaleRetryTitle),
        content: Text(l10n.outboxStaleRetryMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(confirmContext).pop(false),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(confirmContext).pop(true),
            child: Text(l10n.retry),
          ),
        ],
      ),
    );
  }
}

/// G16-N-3 P2-B-4 Phase 3 — shared sign-out confirmation for the outbox.
///
/// Implemented as ONE helper (rather than a dialog duplicated across the three
/// sign-out entry points) because all three need identical behaviour, and
/// because the decision depends on outbox state: the number of unresolved
/// operations belonging to the CURRENT authenticated scope.
///
/// Two outcomes, matching the approved PD-1:
///  * **keep** — sign out and PRESERVE the outgoing scope's operations, so the
///    same cashier resumes them after signing back in;
///  * **discard** — sign out and remove them (and all foreign-scope entries).
///
/// Cancelling leaves the user signed in and the queue untouched. With no
/// unresolved operations in scope, sign-out proceeds immediately without a
/// dialog — there is nothing to decide about.
Future<void> confirmSignOutWithPendingWork({
  required BuildContext context,
  required WidgetRef ref,
  required AppLocalizations l10n,
}) async {
  final user = ref.read(currentUserProvider);
  final state = ref.read(outboxControllerProvider);

  final pending =
      user == null ? 0 : state.unresolvedFor(user.companyId, user.id).length;

  var discardPendingWork = false;
  if (pending > 0) {
    final choice = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.logoutPendingTitle),
        content: Text(l10n.logoutPendingMessage(pending)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.cancel),
          ),
          // Destructive PD-1 path.
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.logoutDiscardPending),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.logoutKeepPending),
          ),
        ],
      ),
    );
    // null => cancelled: stay signed in, touch nothing.
    if (choice == null) return;
    discardPendingWork = choice;
  }

  final result = await ref
      .read(authStateProvider.notifier)
      .logout(discardPendingWork: discardPendingWork);
  if (!result.queuePersisted && context.mounted) {
    // Honest failure: the sign-out DID complete, but the queue cleanup did not
    // persist. Never report a discard that did not happen.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.logoutCleanupFailed)),
    );
  }
}
