// Phase F5-D-A UX tests for [OutboxIndicatorScope]: generic (non-sale)
// pending/failed wording, kind-aware failed-entry titles, a reactive failed
// dialog, manual Retry/Discard semantics, and RU/KK/EN variants through the
// project's standard AppLocalizations infrastructure.
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_indicator.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_scheduler.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/services/connectivity_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Records every post (path + per-request headers) and answers according to
/// the configured responder (2xx by default, may be swapped per test).
class _SpyApi implements ApiClient {
  final List<({String path, Map<String, dynamic>? headers})> posts = [];

  /// May return a body or throw (e.g. a [DioException] for a 5xx).
  Object? Function(String path, Object? data)? responder;

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    posts.add((path: path, headers: options?.headers));
    final body = responder!(path, data);
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: body as T?,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Manually advanced fake retry-timer schedule (no real waiting, clean
/// teardown — no pending-timer failures at the end of the widget test).
class _FakeTimer implements Timer {
  _FakeTimer(this._schedule, this.delay, this._callback) {
    _schedule.add(this);
  }

  final List<_FakeTimer> _schedule;
  final Duration delay;
  final void Function() _callback;
  bool _cancelled = false;

  void fire() {
    if (_cancelled || !_schedule.contains(this)) return;
    _schedule.remove(this);
    _callback();
  }

  @override
  void cancel() {
    _cancelled = true;
    _schedule.remove(this);
  }

  @override
  bool get isActive => !_cancelled && _schedule.contains(this);

  @override
  int get tick => 0;
}

/// Connectivity double wired behind `connectivityServiceProvider`: the REAL
/// ConnectivityStatusNotifier consumes it, so the wiring under test flips
/// ONLINE/OFFLINE through the same Riverpod state the app uses.
class _FakeConnectivity implements ConnectivityService {
  _FakeConnectivity({required bool initialOnline}) : _online = initialOnline;

  bool _online;
  final StreamController<bool> _controller = StreamController<bool>.broadcast();

  void push(bool online) {
    _online = online;
    _controller.add(online);
  }

  @override
  bool get isOnline => _online;

  @override
  Stream<bool> get statusStream => _controller.stream;

  @override
  Future<void> initialize() async {}

  @override
  void dispose() {
    if (!_controller.isClosed) {
      _controller.close();
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const _user = CurrentUser(id: 'user-1', email: 'u@t', companyId: 'company-1');

/// G16-N-3 P2-B-5: a keyed kind's durable identity lives in the PAYLOAD, not
/// only on the operation — this mirrors CashInOutRequest.toJson() in
/// cash_shift_provider. Without it the worker correctly refuses to dispatch.
const _cashPayload = <String, dynamic>{
  'warehouseId': 'wh-1',
  'amount': 100,
  'clientOperationId': 'fixture-identity',
};

OutboxOperation mkOp(
  String id, {
  OutboxOperationKind kind = OutboxOperationKind.cashIn,
  Map<String, dynamic>? payload,
  OutboxStatus status = OutboxStatus.pending,
  DateTime? createdAt,
  DateTime? nextAttemptAt,
  String? lastError,
  String? idempotencyKey,
  // G16-N-3 P2-B-4 Phase 1: scope is EXACTLY companyId + userId.
  String companyId = 'company-1',
  String userId = 'user-1',
}) {
  return OutboxOperation(
    clientOperationId: id,
    kind: kind,
    companyId: companyId,
    userId: userId,
    payload: payload ?? _cashPayload,
    idempotencyKey: idempotencyKey ?? id,
    status: status,
    createdAt: createdAt,
    nextAttemptAt: nextAttemptAt,
    lastError: lastError,
  );
}

DioException _serverError() {
  final options = RequestOptions(path: '/cash/transactions');
  return DioException(
    requestOptions: options,
    response: Response<dynamic>(
      requestOptions: options,
      statusCode: 500,
      data: {'message': 'boom'},
    ),
    type: DioExceptionType.badResponse,
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  late DateTime base;
  late Duration offset;
  late _SpyApi api;
  late List<_FakeTimer> schedule;
  late _FakeConnectivity connectivity;
  late OutboxStorage storage;
  late ProviderContainer container;

  DateTime clock() => base.add(offset);

  Future<void> buildHarness({
    List<OutboxOperation> seeded = const [],
    bool online = true,
    // G16-N-3 P2-B-4 Phase 1: which account is authenticated.
    CurrentUser user = _user,
  }) async {
    base = DateTime(2026, 1, 1, 12);
    offset = Duration.zero;
    api = _SpyApi()..responder = (_, __) => <String, dynamic>{'ok': true};
    schedule = <_FakeTimer>[];
    connectivity = _FakeConnectivity(initialOnline: online);
    final prefs = PreferencesStorage();
    await prefs.initialize();
    storage = OutboxStorage(prefs);
    if (seeded.isNotEmpty) await storage.save(seeded);
    container = ProviderContainer(
      overrides: [
        outboxStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(api),
        currentUserProvider.overrideWithValue(user),
        connectivityServiceProvider.overrideWithValue(connectivity),
        outboxControllerProvider.overrideWith(
          (ref) =>
              OutboxController(ref.watch(outboxStorageProvider), now: clock),
        ),
        outboxSchedulerClockProvider.overrideWithValue(clock),
        outboxSchedulerTimerFactoryProvider.overrideWithValue(
          (Duration delay, void Function() onFire) =>
              _FakeTimer(schedule, delay, onFire),
        ),
      ],
    );
    addTearDown(container.dispose);
  }

  Future<void> pumpApp(WidgetTester tester, {Locale? locale}) {
    return tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: locale,
          home: const Scaffold(
            body: OutboxIndicatorScope(child: Text('content')),
          ),
        ),
      ),
    );
  }

  Future<void> openFailedDialog(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.error_outline));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
  }

  group('OutboxIndicatorScope (F5-D-A)', () {
    testWidgets(
      'mixed-kind queue shows generic pending/failed wording, never "sales"',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp('ch-1', nextAttemptAt: DateTime(2026, 1, 1, 13)),
            mkOp(
              'ch-2',
              kind: OutboxOperationKind.adjustStock,
              status: OutboxStatus.failedPermanent,
              lastError: 'boom',
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();

        expect(find.textContaining('1 pending change'), findsOneWidget);
        expect(find.textContaining('1 change failed to sync'), findsOneWidget);
        expect(find.textContaining('sales'), findsNothing);
      },
    );

    testWidgets(
      'failed cashIn shows the localized kind label, never the UUID',
      (tester) async {
        const uuid = 'c58d4f2e-9a17-4b11-8f2a-1a2b3c4d5e6f';
        await buildHarness(
          seeded: [
            mkOp(
              uuid,
              status: OutboxStatus.failedPermanent,
              lastError: 'Server rejected',
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        expect(find.text('Cash in'), findsOneWidget);
        expect(find.textContaining(uuid), findsNothing);
      },
    );

    testWidgets(
      'failed goodsReceipt shows its kind label',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp(
              'gr-1',
              kind: OutboxOperationKind.goodsReceipt,
              status: OutboxStatus.failedPermanent,
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        expect(find.text('Goods receipt'), findsOneWidget);
      },
    );

    testWidgets(
      'failed createSale keeps the saleNumber as the entry title',
      (tester) async {
        const uuid = 'aaaa1111-bbbb-2222-cccc-3333dddd4444';
        await buildHarness(
          seeded: [
            mkOp(
              uuid,
              kind: OutboxOperationKind.createSale,
              status: OutboxStatus.failedPermanent,
              payload: const {'saleNumber': 'SALE-42'},
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        expect(find.text('SALE-42'), findsOneWidget);
        expect(find.textContaining(uuid), findsNothing);
      },
    );

    testWidgets(
      'lastError stays the entry subtitle',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp(
              'gr-2',
              kind: OutboxOperationKind.goodsReceipt,
              status: OutboxStatus.failedPermanent,
              lastError: 'HTTP 500 from /inventory/stock/documents',
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        expect(
          find.text('HTTP 500 from /inventory/stock/documents'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'manual Retry re-enters the pipeline with the SAME idempotency key',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp('retry-1',
                status: OutboxStatus.failedPermanent, lastError: 'boom'),
          ],
        );
        // The auto cold-start flush would hit 2xx and REMOVE the op before we
        // can exercise Retry — so make every post FAIL (5xx) BEFORE pumping.
        api.responder = (_, __) => throw _serverError();
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        await tester.tap(find.byIcon(Icons.refresh));
        // Retry + syncAll are async: pump several times.
        for (var i = 0; i < 8; i++) {
          await tester.pump();
        }

        // Retry re-uses the ORIGINAL key and the 5xx puts the op back into
        // the pipeline: PENDING, attempt 1, backoff deadline, timer armed.
        expect(api.posts, hasLength(1));
        expect(api.posts.single.headers?['Idempotency-Key'], 'retry-1');
        final state = container.read(outboxControllerProvider);
        expect(state.operations, hasLength(1));
        final op = state.operations.single;
        expect(op.status, OutboxStatus.pending);
        expect(op.attempts, 1);
        expect(op.nextAttemptAt, isNotNull);
        expect(schedule, isNotEmpty);
      },
    );

    testWidgets(
      'Discard removes the failed op',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp('disc-1',
                status: OutboxStatus.failedPermanent, lastError: 'boom'),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        await tester.tap(find.byIcon(Icons.delete_outline));
        await tester.pump();
        await tester.pump();

        expect(api.posts, isEmpty);
        expect(container.read(outboxControllerProvider).operations, isEmpty);
      },
    );

    testWidgets(
      'failed dialog is reactive: an entry removed via Discard disappears '
      'without reopening the dialog',
      (tester) async {
        final baseTime = base;
        await buildHarness(
          seeded: [
            mkOp(
              'c1',
              status: OutboxStatus.failedPermanent,
              createdAt: baseTime,
              lastError: 'e1',
            ),
            mkOp(
              'g1',
              kind: OutboxOperationKind.goodsReceipt,
              status: OutboxStatus.failedPermanent,
              createdAt: baseTime.add(const Duration(seconds: 1)),
              lastError: 'e2',
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();
        await openFailedDialog(tester);

        expect(find.text('Cash in'), findsOneWidget);
        expect(find.text('Goods receipt'), findsOneWidget);

        // Drop the FIRST ListTile (cashIn, FIFO → index 0).
        await tester.tap(find.byIcon(Icons.delete_outline).first);
        await tester.pump();
        await tester.pump();

        expect(find.text('Cash in'), findsNothing);
        expect(find.text('Goods receipt'), findsOneWidget);
        expect(
            container.read(outboxControllerProvider).operations, hasLength(1));
      },
    );

    testWidgets(
      'failed counter uses generic wording for a mixed failed queue',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp(
              'a1',
              kind: OutboxOperationKind.cashOut,
              status: OutboxStatus.failedPermanent,
              nextAttemptAt: DateTime(2026, 1, 1, 13),
            ),
            mkOp(
              'a2',
              kind: OutboxOperationKind.goodsReceipt,
              status: OutboxStatus.failedPermanent,
            ),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();

        expect(find.textContaining('2 changes failed to sync'), findsOneWidget);
        expect(find.textContaining('sales'), findsNothing);
      },
    );

    testWidgets(
      'RU locale: generic pending label, dialog title and kind label',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp(
              'ru-1',
              status: OutboxStatus.failedPermanent,
              nextAttemptAt: DateTime(2026, 1, 1, 13),
            ),
          ],
        );
        await pumpApp(tester, locale: const Locale('ru'));
        await tester.pump();
        await tester.pump();

        expect(find.textContaining('изменение с ошибкой отправки'),
            findsOneWidget);
        await openFailedDialog(tester);
        expect(find.text('Отложенные изменения с ошибками'), findsOneWidget);
        expect(find.text('Внесение кассы'), findsOneWidget);
      },
    );

    testWidgets(
      'KK locale: generic pending label, dialog title and kind label',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp(
              'kk-1',
              status: OutboxStatus.failedPermanent,
              nextAttemptAt: DateTime(2026, 1, 1, 13),
            ),
          ],
        );
        await pumpApp(tester, locale: const Locale('kk'));
        await tester.pump();
        await tester.pump();

        expect(find.textContaining('жіберілмеген өзгеріс'), findsOneWidget);
        await openFailedDialog(tester);
        expect(find.text('Қателері бар күтетін өзгерістер'), findsOneWidget);
        expect(find.text('Кассаға ақша салу'), findsOneWidget);
      },
    );

    testWidgets(
      'sendingCount > 0 → Send now is replaced by a progress indicator, '
      'not tappable',
      (tester) async {
        // Seed a future-due op so the scheduler's cold-start flush does NOT
        // auto-send it. The bar is visible (queue non-empty) but idle.
        await buildHarness(
          seeded: [
            mkOp('send-1', nextAttemptAt: DateTime(2026, 1, 1, 13)),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();

        // Initially: "Send now" is visible, no progress indicator.
        expect(find.text('Send now'), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsNothing);

        // Directly transition the op to `sending` — this is a pure UI test,
        // so we bypass the real sync pipeline and drive the controller
        // state directly. The scheduler's ref.listen re-evaluates and
        // disarms its timer (no pending ops left), but the UI sees the
        // sending state and swaps the button for the spinner.
        await tester.runAsync(
          () => container
              .read(outboxControllerProvider.notifier)
              .markSending('send-1'),
        );
        // Replay the controller mutation so the ConsumerWidget rebuilds.
        await tester.pump();
        await tester.pump();

        expect(
          container.read(outboxControllerProvider).sendingCount,
          1,
        );
        // The button is replaced by the progress indicator (nothing to tap —
        // repeated taps are impossible).
        expect(find.text('Send now'), findsNothing);
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expect(find.textContaining('1 pending change'), findsOneWidget);
      },
    );

    testWidgets(
      'sendingCount == 0 → Send now is back and tappable',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp('idle-1', nextAttemptAt: DateTime(2026, 1, 1, 13)),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();

        expect(find.text('Send now'), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsNothing);
        // Tapping it triggers exactly one worker flush.
        await tester.tap(find.text('Send now'));
        await tester.pump();
        await tester.pump();
        expect(api.posts, hasLength(1));
      },
    );

    testWidgets(
      'indicator bar exposes a semantic label with generic wording',
      (tester) async {
        await buildHarness(
          seeded: [
            mkOp('sem-1', status: OutboxStatus.failedPermanent, lastError: 'e'),
          ],
        );
        await pumpApp(tester);
        await tester.pump();
        await tester.pump();

        // The visible bar exposes a semantic label built from the generic
        // localized wording (pending + failed), so a screen reader announces
        // the queue state without technical terms.
        expect(
          find.bySemanticsLabel(RegExp('pending change.*failed to sync')),
          findsOneWidget,
        );
      },
    );
  });

  group('outboxOfflineQueuedMessage l10n (F5-D-C)', () {
    testWidgets('EN locale returns the English message', (tester) async {
      await buildHarness();
      await pumpApp(tester, locale: const Locale('en'));
      await tester.pump();

      final l10n = AppLocalizations.of(
        tester.element(find.text('content')),
      )!;
      expect(
        l10n.outboxOfflineQueuedMessage,
        contains('No internet connection'),
      );
    });

    testWidgets('RU locale returns the Russian message', (tester) async {
      await buildHarness();
      await pumpApp(tester, locale: const Locale('ru'));
      await tester.pump();

      final l10n = AppLocalizations.of(
        tester.element(find.text('content')),
      )!;
      expect(
        l10n.outboxOfflineQueuedMessage,
        contains('Нет подключения'),
      );
    });

    testWidgets('KK locale returns the Kazakh message', (tester) async {
      await buildHarness();
      await pumpApp(tester, locale: const Locale('kk'));
      await tester.pump();

      final l10n = AppLocalizations.of(
        tester.element(find.text('content')),
      )!;
      expect(
        l10n.outboxOfflineQueuedMessage,
        contains('Интернетке қосылу жоқ'),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 0 (F4) + Phase 1 (F2) — widget level.
  //
  // Phase 1 tests assert the LOAD-BEARING property: the authenticated user
  // can never see, count, or read a foreign-scope operation. This is the
  // mandatory precondition for Phase 3, where same-scope operations survive
  // logout while foreign-scope ones remain in storage.
  //
  // Phase 0 tests assert age is DISPLAY ONLY: it is rendered, it may add one
  // confirmation before a user-initiated retry, and it never blocks, never
  // mutates and never alters the operation identity.
  // ───────────────────────────────────────────────────────────────────
  group('Phase 0 + Phase 1 (G16-N-3 P2-B-4)', () {
    const otherUser =
        CurrentUser(id: 'user-2', email: 'other@t', companyId: 'company-1');
    // Cross-company isolation is exercised by authenticating the DEFAULT
    // user-1 and seeding an op owned by company-2 — see the
    // "different company" and "mixed queue" cases below.

    OutboxOperation failedOp(
      String id, {
      DateTime? createdAt,
      String companyId = 'company-1',
      String userId = 'user-1',
      String? lastError = 'boom',
    }) =>
        mkOp(
          id,
          status: OutboxStatus.failedPermanent,
          createdAt: createdAt,
          lastError: lastError,
          companyId: companyId,
          userId: userId,
        );

    // The retry scheduler is armed by OutboxIndicatorScope and fires an
    // initial burst, so a PENDING op that must stay visible for assertions
    // cannot be due — it would be dispatched and removed first.
    // clock() == 2026-01-01 12:00.
    final notDue = DateTime(2026, 1, 1, 13);
    OutboxOperation heldOp(
      String id, {
      String companyId = 'company-1',
      String userId = 'user-1',
    }) =>
        mkOp(id, nextAttemptAt: notDue, companyId: companyId, userId: userId);

    // ── Phase 0: age display ──────────────────────────────────────────
    testWidgets('failed dialog renders the operation age', (tester) async {
      // clock() == base == 2026-01-01 12:00, so a 2025-12-01 createdAt is
      // exactly 31 days old.
      await buildHarness(
        seeded: [failedOp('age-1', createdAt: DateTime(2025, 12, 1, 12))],
      );
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      expect(find.textContaining('31 days ago'), findsOneWidget);
      // The error is still shown alongside the age.
      expect(find.textContaining('boom'), findsOneWidget);
    });

    testWidgets('hours and minutes are rendered, not raw timestamps',
        (tester) async {
      await buildHarness(
        seeded: [
          failedOp('age-h', createdAt: DateTime(2026, 1, 1, 6)),
          failedOp('age-m', createdAt: DateTime(2026, 1, 1, 11, 30)),
        ],
      );
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      expect(find.textContaining('6 hours ago'), findsOneWidget);
      expect(find.textContaining('30 minutes ago'), findsOneWidget);
    });

    testWidgets('a null createdAt renders an explicit "Age unknown"',
        (tester) async {
      await buildHarness(seeded: [failedOp('age-null')]);
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      expect(find.textContaining('Age unknown'), findsOneWidget);
      // Nothing stale is inferred from an unknown age.
      expect(find.text('Retry an old change?'), findsNothing);
    });

    // ── Phase 0: stale retry confirmation ─────────────────────────────
    testWidgets('a stale operation asks for confirmation before retrying',
        (tester) async {
      await buildHarness(
        seeded: [failedOp('stale-1', createdAt: DateTime(2020, 1, 1))],
      );
      // 5xx keeps the op in the queue so its post-retry state is observable.
      api.responder = (_, __) => throw _serverError();
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      await tester.tap(find.byIcon(Icons.refresh));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('Retry an old change?'), findsOneWidget);

      // Confirming retries normally.
      await tester.tap(find.widgetWithText(TextButton, 'Retry'));
      for (var i = 0; i < 8; i++) {
        await tester.pump();
      }

      // Exactly one dispatch, carrying the ORIGINAL durable identity: the age
      // confirmation never mints or rewrites an operation id.
      expect(api.posts, hasLength(1));
      expect(api.posts.single.headers?['Idempotency-Key'], 'stale-1');

      final op = container.read(outboxControllerProvider).operations.single;
      expect(op.status, OutboxStatus.pending);
      expect(op.attempts, 1);
      expect(op.clientOperationId, 'stale-1');
      expect(op.idempotencyKey, 'stale-1');
      expect(op.createdAt, DateTime(2020, 1, 1));
    });

    testWidgets('cancelling the stale confirmation changes nothing',
        (tester) async {
      await buildHarness(
        seeded: [failedOp('stale-2', createdAt: DateTime(2020, 1, 1))],
      );
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      await tester.tap(find.byIcon(Icons.refresh));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Retry an old change?'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      final op = container.read(outboxControllerProvider).operations.single;
      expect(op.status, OutboxStatus.failedPermanent);
      expect(op.attempts, 0);
      expect(op.lastError, 'boom');
      expect(op.clientOperationId, 'stale-2');
      expect(op.idempotencyKey, 'stale-2');
      expect(op.createdAt, DateTime(2020, 1, 1));
      // Cancelling is a true no-op: nothing was dispatched.
      expect(api.posts, isEmpty);
    });

    testWidgets('a fresh operation retries without any confirmation',
        (tester) async {
      await buildHarness(
        seeded: [failedOp('fresh-1', createdAt: DateTime(2025, 12, 20, 12))],
      );
      api.responder = (_, __) => throw _serverError();
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      await tester.tap(find.byIcon(Icons.refresh));
      for (var i = 0; i < 8; i++) {
        await tester.pump();
      }

      // No confirmation gate for a <30-day operation.
      expect(find.text('Retry an old change?'), findsNothing);
      expect(api.posts, hasLength(1));
      expect(api.posts.single.headers?['Idempotency-Key'], 'fresh-1');
      final op = container.read(outboxControllerProvider).operations.single;
      expect(op.status, OutboxStatus.pending);
      expect(op.clientOperationId, 'fresh-1');
    });

    testWidgets('the stale confirmation is localized, not hardcoded',
        (tester) async {
      await buildHarness(
        seeded: [failedOp('stale-ru', createdAt: DateTime(2020, 1, 1))],
      );
      await pumpApp(tester, locale: const Locale('ru'));
      await tester.pump();
      await openFailedDialog(tester);

      await tester.tap(find.byIcon(Icons.refresh));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Повторить старое изменение?'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Отмена'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(
        container.read(outboxControllerProvider).operations.single.status,
        OutboxStatus.failedPermanent,
      );
    });

    // ── Phase 1: scope isolation ──────────────────────────────────────
    testWidgets('a foreign user\'s failed op is invisible and uncounted',
        (tester) async {
      await buildHarness(
        seeded: [
          failedOp('mine-f'),
          failedOp('theirs-f', userId: 'user-2'),
        ],
        user: otherUser,
      );
      await pumpApp(tester);
      await tester.pump();

      // The badge counts ONLY user-2's single operation.
      expect(find.textContaining('1 change failed to sync'), findsOneWidget);

      await openFailedDialog(tester);
      // user-2's own op is listed...
      expect(find.byType(ListTile), findsOneWidget);
      // ...and user-1's op — including its payload/error — is nowhere.
      expect(find.text('mine-f'), findsNothing);
      expect(find.textContaining('2 changes failed'), findsNothing);
    });

    testWidgets('a different company\'s op never contributes to any count',
        (tester) async {
      await buildHarness(
        seeded: [
          failedOp('x-co', companyId: 'company-1'),
          failedOp('y-co', companyId: 'company-2'),
        ],
      );
      await pumpApp(tester);
      await tester.pump();

      expect(find.textContaining('1 change failed to sync'), findsOneWidget);
      expect(find.textContaining('2 changes failed'), findsNothing);

      await openFailedDialog(tester);
      expect(find.byType(ListTile), findsOneWidget);
      expect(find.text('y-co'), findsNothing);
    });

    testWidgets('a queue holding only foreign ops renders no outbox bar',
        (tester) async {
      await buildHarness(
        seeded: [
          failedOp('theirs-1', userId: 'user-2'),
          failedOp('theirs-2', companyId: 'company-77'),
        ],
      );
      await pumpApp(tester);
      await tester.pump();

      // Neither the bar nor the error entry point is rendered, so nothing
      // about the other accounts' backlog is disclosed.
      expect(find.byIcon(Icons.cloud_upload_outlined), findsNothing);
      expect(find.byIcon(Icons.error_outline), findsNothing);
      expect(find.textContaining('failed to sync'), findsNothing);
      // The content itself still renders.
      expect(find.text('content'), findsOneWidget);
    });

    testWidgets('a foreign createSale payload saleNumber is never rendered',
        (tester) async {
      await buildHarness(
        seeded: [
          mkOp(
            'theirs-sale',
            kind: OutboxOperationKind.createSale,
            payload: const {'saleNumber': 'OFF-SECRET-SALE'},
            status: OutboxStatus.failedPermanent,
            userId: 'user-2',
          ),
        ],
      );
      await pumpApp(tester);
      await tester.pump();

      expect(find.byIcon(Icons.error_outline), findsNothing);
      expect(find.text('OFF-SECRET-SALE'), findsNothing);
    });

    testWidgets('mixed queue: only the current scope is counted and listed',
        (tester) async {
      await buildHarness(
        seeded: [
          heldOp('mine-p'),
          failedOp('mine-f'),
          heldOp('theirs-p', userId: 'user-2'),
          failedOp('theirs-f', userId: 'user-2'),
          heldOp('other-co-p', companyId: 'company-2'),
          failedOp('other-co-f', companyId: 'company-2'),
        ],
      );
      await pumpApp(tester);
      await tester.pump();

      // Exactly one pending and one failed operation belong to user-1.
      expect(find.textContaining('1 pending change'), findsOneWidget);
      expect(find.textContaining('1 change failed to sync'), findsOneWidget);

      await openFailedDialog(tester);
      expect(find.byType(ListTile), findsOneWidget);
      expect(find.text('theirs-f'), findsNothing);
      expect(find.text('other-co-f'), findsNothing);
    });

    testWidgets('an unauthenticated session renders no outbox bar',
        (tester) async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final st = OutboxStorage(prefs);
      await st.save([failedOp('anon-f')]);
      container = ProviderContainer(
        overrides: [
          outboxStorageProvider.overrideWithValue(st),
          apiClientProvider.overrideWithValue(api),
          // No currentUserProvider override -> unauthenticated.
          connectivityServiceProvider.overrideWithValue(connectivity),
          outboxControllerProvider.overrideWith(
            (ref) =>
                OutboxController(ref.watch(outboxStorageProvider), now: clock),
          ),
          outboxSchedulerClockProvider.overrideWithValue(clock),
        ],
      );
      addTearDown(container.dispose);
      await pumpApp(tester);
      await tester.pump();

      expect(find.byIcon(Icons.cloud_upload_outlined), findsNothing);
      expect(find.text('content'), findsOneWidget);
    });

    testWidgets('scope filtering mutates nothing — the queue is intact',
        (tester) async {
      await buildHarness(
        seeded: [
          failedOp('mine-f'),
          failedOp('theirs-f', userId: 'user-2'),
        ],
      );
      await pumpApp(tester);
      await tester.pump();
      await openFailedDialog(tester);

      // Both entries are still persisted, in full, with identity intact.
      final ops = container.read(outboxControllerProvider).operations;
      expect(ops, hasLength(2));
      expect(
        ops.map((o) => o.clientOperationId).toSet(),
        {'mine-f', 'theirs-f'},
      );
      for (final o in ops) {
        expect(o.idempotencyKey, o.clientOperationId);
        expect(o.createdAt, isNull);
        expect(o.status, OutboxStatus.failedPermanent);
      }
    });

    testWidgets('a foreign-scope op is still never SENT by the worker',
        (tester) async {
      // Layer-2 confirmation: the sync worker's own scope guard is unchanged
      // and remains the dispatch-time authority.
      await buildHarness(
        seeded: [
          mkOp('mine-p'),
          mkOp('theirs-p', userId: 'user-2'),
          mkOp('other-co-p', companyId: 'company-2'),
        ],
      );
      await pumpApp(tester);
      await tester.pump();

      await container.read(outboxSyncProvider).syncAll();
      await tester.pump();

      final paths = api.posts.map((p) => p.path).toList();
      expect(paths, hasLength(1));
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 2 — visible queue pressure on the existing bar.
  //
  // The warning must be SCOPED: a foreign account sitting at 200 must not
  // put this account's bar into a pressure state, and must never leak a
  // count.
  // ─────────────────────────────────────────────────────────────────────
  group('Phase 2 — queue pressure indicator', () {
    List<OutboxOperation> bulk(int n, {String userId = 'user-1'}) => [
          for (var i = 0; i < n; i++)
            mkOp(
              'bulk-$i',
              userId: userId,
              nextAttemptAt: DateTime(2026, 1, 1, 13),
            ),
        ];

    testWidgets('no pressure below the soft cap', (tester) async {
      await buildHarness(seeded: bulk(OutboxController.softCapacityLimit - 1));
      await pumpApp(tester);
      await tester.pump();

      expect(find.textContaining('waiting to sync'), findsNothing);
      expect(find.textContaining('pending change'), findsOneWidget);
    });

    testWidgets('pressure is visible at the soft cap', (tester) async {
      await buildHarness(seeded: bulk(OutboxController.softCapacityLimit));
      await pumpApp(tester);
      await tester.pump();

      expect(find.textContaining('waiting to sync'), findsOneWidget);
      // Still fully functional — the soft cap never gates anything.
      expect(find.byIcon(Icons.cloud_upload_outlined), findsOneWidget);
    });

    testWidgets('pressure is localized (RU)', (tester) async {
      await buildHarness(seeded: bulk(OutboxController.softCapacityLimit));
      await pumpApp(tester, locale: const Locale('ru'));
      await tester.pump();

      expect(find.textContaining('ожидают отправки'), findsOneWidget);
    });

    testWidgets('a foreign scope at the hard cap shows no pressure here',
        (tester) async {
      await buildHarness(
        seeded: bulk(OutboxController.hardCapacityLimit, userId: 'user-2'),
        user: const CurrentUser(
            id: 'user-1', email: 'u@t', companyId: 'company-1'),
      );
      await pumpApp(tester);
      await tester.pump();

      // Nothing at all is rendered for this user.
      expect(find.byIcon(Icons.cloud_upload_outlined), findsNothing);
      expect(find.textContaining('waiting to sync'), findsNothing);
      expect(find.text('content'), findsOneWidget);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-5 — blocked-operation resolution surface.
  //
  // A blocked operation is PENDING, so it never reaches the FAILED_PERMANENT
  // dialog and had no per-item affordance at all. These tests pin that it is
  // individually visible, resolvable, scope-safe, and that "Send anyway" is a
  // disclosed risk acceptance rather than a silent retry.
  // ───────────────────────────────────────────────────────────────────────
  group('P2-B-5 blocked-operation surface', () {
    /// A legacy keyed op: operation-level ids set, NO payload identity.
    OutboxOperation legacyOp(
      String id, {
      OutboxOperationKind kind = OutboxOperationKind.cashIn,
      Map<String, dynamic>? payload,
    }) {
      return OutboxOperation(
        clientOperationId: id,
        kind: kind,
        companyId: 'company-1',
        userId: 'user-1',
        payload: payload ??
            const {'amount': 10.0, 'warehouseId': 'wh-1'},
        idempotencyKey: id,
        createdAt: DateTime(2026, 1, 1),
      );
    }

    Finder blockedButton() => find.byIcon(Icons.help_outline);

    /// The per-item actions live inside a collapsed ExpansionTile — expanding it
    /// IS the "View details" affordance.
    Future<void> expandFirstItem(WidgetTester tester) async {
      await tester.tap(find.byType(ExpansionTile).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
    }

    testWidgets('blocked operations raise their own affordance and are listed '
        'individually', (tester) async {
      await buildHarness(seeded: [legacyOp('blk-1'), legacyOp('blk-2')]);
      await pumpApp(tester);
      await tester.pump();

      expect(blockedButton(), findsOneWidget);
      // The FAILED affordance must NOT appear: nothing is failedPermanent.
      expect(find.byIcon(Icons.error_outline), findsNothing);

      await tester.tap(blockedButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      // Both operations are listed. Following the established convention the
      // raw operation UUID is NOT surfaced (see the existing failed-list
      // assertions); entries are identified by their localized kind.
      expect(find.text('Cash in'), findsNWidgets(2));
    });

    testWidgets('an operation WITH a durable identity raises no blocked '
        'affordance', (tester) async {
      await buildHarness(seeded: [mkOp('ok-1')]);
      await pumpApp(tester);
      await tester.pump();
      expect(blockedButton(), findsNothing);
    });

    testWidgets('goodsReceipt and createSale are never blocked', (tester) async {
      await buildHarness(
        seeded: [
          OutboxOperation(
            clientOperationId: 'gr-1',
            kind: OutboxOperationKind.goodsReceipt,
            companyId: 'company-1',
            userId: 'user-1',
            payload: const {'receiptNumber': 'GR-1'},
            createdAt: DateTime(2026, 1, 1),
          ),
          OutboxOperation(
            clientOperationId: 'sale-1',
            kind: OutboxOperationKind.createSale,
            companyId: 'company-1',
            userId: 'user-1',
            payload: const {'saleNumber': 'OFF-1'},
            createdAt: DateTime(2026, 1, 1),
          ),
        ],
      );
      await pumpApp(tester);
      await tester.pump();
      expect(blockedButton(), findsNothing);
    });

    testWidgets('the blocked list is scoped: another user sees no blocked '
        'affordance for it', (tester) async {
      await buildHarness(
        seeded: [legacyOp('blk-1')],
        user: const CurrentUser(
          id: 'user-2',
          email: 'other@test',
          companyId: 'company-2',
        ),
      );
      await pumpApp(tester);
      await tester.pump();
      expect(blockedButton(), findsNothing);
    });

    testWidgets('Discard removes the operation and releases its capacity',
        (tester) async {
      await buildHarness(seeded: [legacyOp('blk-1')]);
      await pumpApp(tester);
      await tester.pump();
      await tester.tap(blockedButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      await expandFirstItem(tester);
      await tester.tap(find.text(AppLocalizations.of(
        tester.element(find.byType(AlertDialog).first),
      )!.outboxIdentityMissingDiscard).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      final state = container.read(outboxControllerProvider);
      expect(state.unresolvedFor('company-1', 'user-1'), isEmpty);
      expect(state.capacityUsedFor('company-1', 'user-1'), 0);
    });

    testWidgets('Send anyway requires an explicit confirmation and the dialog '
        'discloses the duplicate risk', (tester) async {
      await buildHarness(seeded: [legacyOp('blk-1')]);
      await pumpApp(tester);
      await tester.pump();
      await tester.tap(blockedButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(AlertDialog).first),
      )!;
      await expandFirstItem(tester);
      await tester.tap(find.text(l10n.outboxIdentityMissingConfirm).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      // A SECOND dialog now demands the explicit risk acceptance.
      expect(find.text(l10n.outboxIdentityMissingTitle), findsWidgets);
      expect(find.text(l10n.outboxIdentityMissingConfirm), findsWidgets);
      // Nothing was dispatched merely by opening the dialogs.
      expect(api.posts, isEmpty);
      expect(
        container.read(outboxControllerProvider).operations.single.status,
        OutboxStatus.pending,
      );
    });

    testWidgets('confirming Send anyway dispatches the ORIGINAL payload with '
        'no identity minted', (tester) async {
      await buildHarness(seeded: [legacyOp('blk-1')]);
      await pumpApp(tester);
      await tester.pump();
      await tester.tap(blockedButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(AlertDialog).first),
      )!;
      await expandFirstItem(tester);
      await tester.tap(find.text(l10n.outboxIdentityMissingConfirm).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.text(l10n.outboxIdentityMissingConfirm).last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump(const Duration(milliseconds: 250));

      expect(api.posts, hasLength(1));
      // The ORIGINAL operation identity travelled with the request — nothing was
      // regenerated. (The "no clientOperationId is minted into the payload"
      // half of this invariant is pinned at the worker level in
      // outbox_durable_identity_guard_test.dart.)
      expect(api.posts.single.headers?['Idempotency-Key'], 'blk-1');
      expect(
        container.read(outboxControllerProvider).operations,
        isEmpty,
        reason: 'a confirmed send that succeeds removes the operation',
      );
    });

    testWidgets('cancelling the confirmation mutates nothing', (tester) async {
      await buildHarness(seeded: [legacyOp('blk-1')]);
      await pumpApp(tester);
      await tester.pump();
      await tester.tap(blockedButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(AlertDialog).first),
      )!;
      await expandFirstItem(tester);
      await tester.tap(find.text(l10n.outboxIdentityMissingConfirm).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.text(l10n.cancel).last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(api.posts, isEmpty);
      final op = container.read(outboxControllerProvider).operations.single;
      expect(op.status, OutboxStatus.pending);
      expect(op.attempts, 0);
      expect(op.nextAttemptAt, isNull);
      expect(op.payload.containsKey('clientOperationId'), isFalse);
    });

    testWidgets('the blocked surface is independent of the failed/stale '
        'surface', (tester) async {
      await buildHarness(seeded: [
        legacyOp('blk-1'),
        mkOp('failed-1', status: OutboxStatus.failedPermanent, lastError: 'x'),
      ]);
      await pumpApp(tester);
      await tester.pump();

      // Both affordances coexist.
      expect(blockedButton(), findsOneWidget);
      expect(find.byIcon(Icons.error_outline), findsOneWidget);

      // The failed dialog still lists only the failedPermanent entry.
      await tester.tap(find.byIcon(Icons.error_outline));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Cash in'), findsWidgets);
    });

    testWidgets('RU localization renders the blocked affordance', (
      tester,
    ) async {
      await buildHarness(seeded: [legacyOp('blk-1')]);
      await pumpApp(tester, locale: const Locale('ru'));
      await tester.pump();
      expect(blockedButton(), findsOneWidget);
      await tester.tap(blockedButton());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Требуется вашего подтверждения'), findsWidgets);
    });
  });
}
