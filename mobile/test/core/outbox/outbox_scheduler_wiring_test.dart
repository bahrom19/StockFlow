// Phase F5-C-B wiring tests: [OutboxRetryScheduler] driven through
// outboxSchedulerProvider exactly as the outbox indicator wires it, running
// the REAL OutboxController + OutboxSyncService + spec registry over a stubbed
// ApiClient and a manually advanced clock / fake timer schedule.
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

/// Records every post (path + per-request headers) and answers 2xx or throws
/// according to the configured responder.
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

/// Manually advanced fake retry-timer schedule (no real waiting).
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

OutboxOperation cashOp(
  String id, {
  String company = 'company-1',
  OutboxStatus status = OutboxStatus.pending,
}) {
  return OutboxOperation(
    clientOperationId: id,
    kind: OutboxOperationKind.cashIn,
    companyId: company,
    userId: 'user-1',
    payload: const {'warehouseId': 'wh-1', 'amount': 100},
    status: status,
    idempotencyKey: id,
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

  Future<void> settle() async {
    await pumpEventQueue();
    await Future<void>.delayed(Duration.zero);
  }

  Future<void> buildHarness({
    List<OutboxOperation> seeded = const [],
    bool online = true,
  }) async {
    base = DateTime(2026, 1, 1, 12);
    offset = Duration.zero;
    api = _SpyApi()
      ..responder = (_, __) => <String, dynamic>{'ok': true};
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
          (ref) => OutboxController(ref.watch(outboxStorageProvider), now: clock),
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

  /// The exact wiring the outbox indicator performs on cold start.
  void start() {
    container.read(outboxInitProvider);
    container.read(outboxSchedulerProvider);
  }

  OutboxOperation? singleOp() {
    final state = container.read(outboxControllerProvider);
    return state.operations.isEmpty ? null : state.operations.single;
  }

  group('OutboxRetryScheduler wiring (F5-C-B)', () {
    testWidgets(
      'indicator wiring: persisted PENDING + ONLINE cold start → exactly one flush',
      (tester) async {
        await buildHarness(seeded: [cashOp('idem-2')]);
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: const MaterialApp(
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: Scaffold(
                body: OutboxIndicatorScope(child: Text('content')),
              ),
            ),
          ),
        );
        await tester.pump();
        // Flush the async flush chain: pump processes microtasks; a second
        // pump covers the worker's awaited continuations. (A plain
        // Future.delayed settle would deadlock inside testWidgets' FakeAsync
        // zone — timers only advance via pump there.)
        await tester.pump();
        await tester.pump();

        expect(api.posts, hasLength(1));
        // The cold-start flush keeps the F4 idempotency contract
        // (capitalized header name, exactly as OutboxSyncService sends it).
        expect(api.posts.single.headers?['Idempotency-Key'], 'idem-2');
        final element = tester.element(find.text('content'));
        final state =
            ProviderScope.containerOf(element).read(outboxControllerProvider);
        expect(state.operations, isEmpty);

        // A repeated lifecycle event (another rebuild) never re-flushes.
        await tester.pump();
        await tester.pump();
        expect(api.posts, hasLength(1));
      },
    );

    test(
      'cold start OFFLINE → no initial flush; reconnect re-arms through the wiring',
      () async {
        await buildHarness(seeded: [cashOp('idem-3')], online: false);
        start();
        await settle();

        expect(api.posts, isEmpty);
        expect(schedule, isEmpty);
        expect(singleOp(), isNotNull);
        expect(singleOp()!.status, OutboxStatus.pending);

        // OFFLINE → ONLINE flip on the single connectivity signal — the same
        // event the app-level bursts use. No second mechanism involved.
        connectivity.push(true);
        await settle();

        expect(api.posts, hasLength(1));
        expect(singleOp(), isNull);
      },
    );

    test(
      'no-op burst: repeated lifecycle/connectivity events never re-fire',
      () async {
        await buildHarness(
          seeded: [cashOp('idem-4', company: 'company-9')],
        );
        start();
        await settle();

        // The scheduler fired once, the worker scope-skipped the foreign op.
        expect(api.posts, isEmpty);
        expect(singleOp(), isNotNull);
        expect(singleOp()!.attempts, 0);

        // Repeated lifecycle events over an unchanged queue: no bursts.
        final scheduler = container.read(outboxSchedulerProvider);
        scheduler.notifyChanged();
        scheduler.notifyChanged();
        connectivity.push(false);
        connectivity.push(true);
        await settle();

        expect(api.posts, isEmpty);
        expect(schedule, isEmpty);
        expect(singleOp()!.attempts, 0);
      },
    );

    test('FAILED_PERMANENT is never auto-flushed by the wiring', () async {
      await buildHarness(
        seeded: [cashOp('idem-5', status: OutboxStatus.failedPermanent)],
      );
      start();
      await settle();

      expect(api.posts, isEmpty);
      expect(schedule, isEmpty);
      expect(singleOp()!.status, OutboxStatus.failedPermanent);

      container.read(outboxSchedulerProvider).notifyChanged();
      await settle();
      expect(api.posts, isEmpty);
    });

    test(
      'cold start → retryable failure → automatic retry at nextAttemptAt → F5-B cap → auto attempts stop',
      () async {
        await buildHarness(seeded: [cashOp('idem-6')]);
        // Every attempt fails with a 5xx → retryable classification.
        api.responder = (_, __) => throw _serverError();
        start();
        await settle();

        // Attempt 1 (cold-start flush): failure schedules the backoff retry.
        expect(api.posts, hasLength(1));
        expect(schedule, hasLength(1));
        var op = singleOp()!;
        expect(op.status, OutboxStatus.pending);
        expect(op.attempts, 1);
        // 5xx backoff after attempt 1: +30s (F5-B formula, untouched).
        expect(
          op.nextAttemptAt!.difference(clock()),
          const Duration(seconds: 30),
        );

        // Advance past the deadline → the armed timer drives attempt 2.
        offset = const Duration(seconds: 31);
        schedule.single.fire();
        await settle();

        expect(api.posts, hasLength(2));
        expect(schedule, hasLength(1));
        op = singleOp()!;
        expect(op.attempts, 2);
        expect(
          op.nextAttemptAt!.difference(clock()),
          const Duration(seconds: 60),
        );

        // The same idempotency key on every automatic attempt (F4 invariant).
        expect(
          api.posts.map((p) => p.headers?['Idempotency-Key']),
          everyElement('idem-6'),
        );

        // Drive the remaining attempts 3..12 by advancing the clock past each
        // armed deadline and firing the single scheduled timer.
        for (var attempt = 3; attempt <= OutboxController.maxRetryAttempts; attempt++) {
          offset += const Duration(minutes: 16);
          schedule.single.fire();
          await settle();
          op = singleOp()!;
          // The 12th retryable failure caps the chain inside the very same
          // markRetryableFailure call (F5-B semantics preserved end-to-end).
          expect(
            op.status,
            attempt < OutboxController.maxRetryAttempts
                ? OutboxStatus.pending
                : OutboxStatus.failedPermanent,
            reason: 'attempt $attempt',
          );
          expect(op.attempts, attempt, reason: 'attempt $attempt');
        }

        // The 12th retryable failure capped the chain (F5-B semantics
        // preserved end-to-end through the wiring).
        op = singleOp()!;
        expect(op.status, OutboxStatus.failedPermanent);
        expect(op.attempts, OutboxController.maxRetryAttempts);
        expect(op.lastError, isNotNull);
        expect(op.nextAttemptAt, isNull);
        expect(container.read(outboxControllerProvider).failedCount, 1);

        // No timer left, and time passing triggers no further attempts.
        expect(schedule, isEmpty);
        offset += const Duration(hours: 3);
        container.read(outboxSchedulerProvider).notifyChanged();
        await settle();
        expect(api.posts, hasLength(OutboxController.maxRetryAttempts));
        expect(singleOp()!.status, OutboxStatus.failedPermanent);

        // The success path still exists — but only through the manual Retry.
        api.responder = (_, __) => <String, dynamic>{'ok': true};
        await container
            .read(outboxControllerProvider.notifier)
            .retryFailed('idem-6');
        await settle();
        expect(api.posts, hasLength(OutboxController.maxRetryAttempts + 1));
        // The manual retry reuses the same immutable key (F4/F5-B invariant).
        expect(
          api.posts.last.headers?['Idempotency-Key'],
          'idem-6',
        );
        expect(singleOp(), isNull);
      },
    );

    test(
      'scheduler keeps planning future retries after the wiring (backoff re-arm)',
      () async {
        await buildHarness(seeded: [cashOp('idem-7')]);
        api.responder = (_, __) => throw _serverError();
        start();
        await settle();

        // Attempt 1 failed → one timer armed on the +30s backoff.
        expect(schedule, hasLength(1));

        // A repeated queue mutation re-arms the SAME single timer (no stack).
        container.read(outboxSchedulerProvider).notifyChanged();
        await settle();
        expect(schedule, hasLength(1));

        // Firing it runs the worker; the next deadline is re-armed.
        offset = const Duration(seconds: 31);
        schedule.single.fire();
        await settle();

        expect(api.posts, hasLength(2));
        expect(schedule, hasLength(1));
        final op = singleOp()!;
        expect(op.attempts, 2);
        expect(
          op.nextAttemptAt!.difference(clock()),
          const Duration(seconds: 60),
        );
      },
    );
  });
}