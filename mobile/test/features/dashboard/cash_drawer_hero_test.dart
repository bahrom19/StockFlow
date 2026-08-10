import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/cash_drawer_hero.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

// ─────────────────────────────────────────────────────────────
// CashDrawerHero — X-report polling guard (20s timer).
//
// The hero must only poll `/sales/cash-shifts/x-report` while an OPEN shift
// actually exists. With no open shift the endpoint 404s, so unconditional
// polling spams 404s and browser console errors (production finding #1).
//
// Covered:
//  - no open shift   → 0 polls (only the bootstrap request)
//  - shift loading   → 0 polls
//  - shift error     → 0 polls
//  - open shift      → polls every 20s
//  - shift closes    → polling stops after the 404 that discovers the close
//  - dispose         → timer cancelled, no requests, no setState-after-dispose
// ─────────────────────────────────────────────────────────────
class _FakeHeroApi extends ApiClient {
  _FakeHeroApi() : super(tokenStorage: TokenStorage());

  /// Number of X-report requests seen by the fake.
  int xReportCalls = 0;

  /// Non-null → the X-report endpoint returns an open shift (200).
  /// Null → 404 ("no open shift"), the normal production shape.
  Map<String, dynamic>? openShift;

  /// True → the X-report endpoint returns 500 (real error state).
  bool failXReport = false;

  static Map<String, dynamic> _warehouse() => {
        'id': 'wh1',
        'companyId': 'c1',
        'name': 'Main Store',
        'code': 'MS',
        'address': null,
        'phone': null,
        'managerName': null,
        'isDefault': true,
        'isActive': true,
        'rowVersion': 0,
        'createdAt': '2026-08-03T10:00:00Z',
        'updatedAt': '2026-08-03T10:00:00Z',
      };

  static Map<String, dynamic> _shift() => {
        'id': 'shift-1',
        'companyId': 'c1',
        'warehouseId': 'wh1',
        'cashierId': 'u1',
        'status': 'OPEN',
        'openedAt': '2026-08-03T10:00:00Z',
        'closedAt': null,
        'openingBalance': '1000.0000',
        'closingBalance': '0.0000',
        'cashSales': '120.0000',
        'cardSales': '30.0000',
        'totalSales': '150.0000',
        'cashIn': '0.0000',
        'cashOut': '0.0000',
        'expectedClosing': '1150.0000',
        'difference': '0.0000',
        'notes': null,
        'rowVersion': 1,
      };

  Response<T> _ok<T>(dynamic data, String path) => Response<T>(
        data: data,
        statusCode: 200,
        requestOptions: RequestOptions(path: path),
      );

  DioException _bad(String path, int status) => DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: status,
          data: {'message': status == 404 ? 'No open shift' : 'boom'},
        ),
        type: DioExceptionType.badResponse,
      );

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    if (path == '${ApiEndpoints.inventory}/warehouses') {
      return _ok<T>([_warehouse()], path);
    }
    if (path == ApiEndpoints.cashShiftXReport) {
      xReportCalls++;
      if (failXReport) throw _bad(path, 500);
      if (openShift != null) return _ok<T>(openShift, path);
      throw _bad(path, 404);
    }
    throw StateError('No GET stub for $path');
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No POST stub for $path');
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No PATCH stub for $path');
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No PUT stub for $path');
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No DELETE stub for $path');
  }
}

/// Seeds a loaded warehouse list + (optionally) a shift bootstrap, then pumps
/// the hero inside a MaterialApp so [ModalRoute.of] reports the route current.
Future<(ProviderContainer, _FakeHeroApi)> _pumpHero(
  WidgetTester tester, {
  required _FakeHeroApi fake,
  bool bootstrapShift = true,
}) async {
  final container = ProviderContainer(overrides: [
    apiClientProvider.overrideWith((ref) => fake),
  ]);
  addTearDown(container.dispose);

  // DashboardScreen owns the warehouse bootstrap; mirror it here.
  await container.read(warehouseListProvider.notifier).loadWarehouses();
  if (bootstrapShift) {
    await container.read(cashShiftProvider.notifier).loadShift('wh1');
  }

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(
        home: Scaffold(body: CashDrawerHero()),
      ),
    ),
  );
  await tester.pump();
  return (container, fake);
}

/// Disposes the widget tree so the hero's periodic timer is cancelled — the
/// test framework fails on pending timers otherwise.
Future<void> tearDownWidget(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump();
}

/// Advances the fake clock past one 20s polling tick and flushes microtasks.
Future<void> tick(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 20));
  await tester.pump();
}

void main() {
  group('CashDrawerHero X-report polling guard', () {
    testWidgets('no open shift → zero polls after bootstrap', (tester) async {
      final fake = _FakeHeroApi(); // openShift == null → 404
      final (_, _) = await _pumpHero(tester, fake: fake);

      // Bootstrap itself issued one X-report request.
      expect(fake.xReportCalls, 1);
      expect(find.text('No open shift'), findsOneWidget);

      await tick(tester);
      await tick(tester);
      expect(fake.xReportCalls, 1); // no polling without an open shift

      await tearDownWidget(tester);
    });

    testWidgets('shift loading → zero polls', (tester) async {
      final fake = _FakeHeroApi();
      // Do NOT bootstrap the shift — state stays ShiftLoading.
      await _pumpHero(tester, fake: fake, bootstrapShift: false);

      expect(fake.xReportCalls, 0);
      expect(find.byType(CashDrawerHeroSkeleton), findsOneWidget);

      await tick(tester);
      await tick(tester);
      expect(fake.xReportCalls, 0);

      await tearDownWidget(tester);
    });

    testWidgets('shift error → zero polls after the failing bootstrap',
        (tester) async {
      final fake = _FakeHeroApi()..failXReport = true;
      await _pumpHero(tester, fake: fake);

      // Bootstrap made one request that failed → ShiftError.
      expect(fake.xReportCalls, 1);
      expect(find.text('Cash drawer unavailable'), findsOneWidget);

      await tick(tester);
      await tick(tester);
      expect(fake.xReportCalls, 1); // no polling from ShiftError

      await tearDownWidget(tester);
    });

    testWidgets('open shift → polls every 20 seconds', (tester) async {
      final fake = _FakeHeroApi()..openShift = _FakeHeroApi._shift();
      await _pumpHero(tester, fake: fake);

      expect(fake.xReportCalls, 1); // bootstrap
      expect(find.text('Cash Drawer'), findsOneWidget);

      await tick(tester);
      expect(fake.xReportCalls, 2);

      await tick(tester);
      expect(fake.xReportCalls, 3);

      await tearDownWidget(tester);
    });

    testWidgets('shift closes → polling stops after the discovering 404',
        (tester) async {
      final fake = _FakeHeroApi()..openShift = _FakeHeroApi._shift();
      await _pumpHero(tester, fake: fake);

      expect(fake.xReportCalls, 1);

      await tick(tester);
      expect(fake.xReportCalls, 2);

      // The shift is closed in the backend: the next poll 404s, the state
      // flips to ShiftLoaded(current: null), and polling must stop.
      fake.openShift = null;
      await tick(tester);
      expect(fake.xReportCalls, 3); // the tick that discovers the close
      expect(find.text('No open shift'), findsOneWidget);

      await tick(tester);
      await tick(tester);
      expect(fake.xReportCalls, 3); // no further polls

      await tearDownWidget(tester);
    });

    testWidgets('dispose cancels the timer — no requests, no exceptions',
        (tester) async {
      final fake = _FakeHeroApi()..openShift = _FakeHeroApi._shift();
      await _pumpHero(tester, fake: fake);

      await tick(tester);
      final before = fake.xReportCalls;
      expect(before, greaterThanOrEqualTo(2));

      // Dispose the widget — cancels _refreshTimer and the _UpdatedLabel
      // ticker. Advancing time afterwards must neither fire requests nor
      // throw (setState-after-dispose would fail the test).
      await tearDownWidget(tester);
      await tick(tester);
      await tick(tester);
      expect(fake.xReportCalls, before);
    });

    // ── Semantics boundary (ddd97fb pattern, P2) ─────────────────────
    // _NoShiftHero wraps its text Column in a label-less
    // Semantics(container: true) so Flutter Web serializes the title +
    // subtitle as textContent (document.body.innerText) instead of hoisting
    // them into the row's role="group" aria-label because of the interactive
    // "Open shift" button.
    testWidgets('no-shift hero: title is its own leaf, CTA separate tappable',
        (tester) async {
      final fake = _FakeHeroApi(); // openShift == null → 404 → _NoShiftHero
      await _pumpHero(tester, fake: fake);

      final handle = tester.ensureSemantics();

      // The title text must carry its own label on a NON-interactive node.
      final titleData =
          tester.getSemantics(find.text('No open shift')).getSemanticsData();
      expect(titleData.label, contains('No open shift'));
      expect(titleData.hasAction(SemanticsAction.tap), isFalse);

      // The CTA remains a separate tappable node — the title was NOT
      // swallowed into the button's label (the f72701d/ddd97fb rule).
      final ctaData =
          tester.getSemantics(find.text('Open shift')).getSemanticsData();
      expect(ctaData.hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
      await tearDownWidget(tester);
    });

    // ── _HeroError semantics boundary (2dac3ea pattern, P3) ───────
    // Like _NoShiftHero, _HeroError wraps its text Column in a label-less
    // Semantics(container: true) so the title + subtitle render as
    // textContent instead of being hoisted into the row's group aria-label
    // by the interactive "Retry" button.
    testWidgets('_HeroError: title its own leaf, Retry separate tappable',
        (tester) async {
      final fake = _FakeHeroApi()..failXReport = true; // → ShiftError
      await _pumpHero(tester, fake: fake);

      final handle = tester.ensureSemantics();

      // Title is its own non-interactive leaf.
      final titleData = tester
          .getSemantics(find.text('Cash drawer unavailable'))
          .getSemanticsData();
      expect(titleData.label, contains('Cash drawer unavailable'));
      expect(titleData.hasAction(SemanticsAction.tap), isFalse);

      // Subtitle is part of the same merged leaf.
      final subData = tester
          .getSemantics(find.text('Could not load the open shift.'))
          .getSemanticsData();
      expect(subData.label, contains('Could not load the open shift.'));

      // Retry stays a separate tappable node.
      final retryData =
          tester.getSemantics(find.text('Retry')).getSemanticsData();
      expect(retryData.hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
      await tearDownWidget(tester);
    });
  });
}
