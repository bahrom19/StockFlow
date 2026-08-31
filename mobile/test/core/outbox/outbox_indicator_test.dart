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

const _cashPayload = <String, dynamic>{
  'warehouseId': 'wh-1',
  'amount': 100,
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
}) {
  return OutboxOperation(
    clientOperationId: id,
    kind: kind,
    companyId: 'company-1',
    userId: 'user-1',
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
        currentUserProvider.overrideWithValue(_user),
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
}
