import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/app.dart';
import 'package:stockflow/core/navigation/app_router.dart';
import 'package:stockflow/core/services/connectivity_service.dart';

class _FakeConnectivity implements Connectivity {
  _FakeConnectivity(this.initial);

  List<ConnectivityResult> initial;
  final _controller = StreamController<List<ConnectivityResult>>.broadcast();

  void emit(List<ConnectivityResult> results) => _controller.add(results);

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async => initial;

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      _controller.stream;
}

GoRouter _router() => GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (_, __) => const Scaffold()),
      ],
    );

Future<void> _pumpApp(
  WidgetTester tester,
  ConnectivityService service,
  int Function() refreshCount,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        connectivityServiceProvider.overrideWithValue(service),
        coreDataRefreshProvider.overrideWithValue([
          () async => refreshCount(),
        ]),
        routerProvider.overrideWithValue(_router()),
      ],
      child: const StockFlowApp(),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('resume + ONLINE → exactly ONE refresh batch', (tester) async {
    final service = ConnectivityService(
      connectivity: _FakeConnectivity([ConnectivityResult.wifi]),
    );
    await service.initialize();
    addTearDown(service.dispose);
    var refreshCount = 0;
    int increment() => refreshCount++;
    await _pumpApp(tester, service, increment);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(refreshCount, 1);

    // Repeated resume inside the debounce window → no second batch.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(refreshCount, 1);
  });

  testWidgets('resume + OFFLINE → no network request at all', (tester) async {
    final service = ConnectivityService(
      connectivity: _FakeConnectivity([ConnectivityResult.none]),
    );
    await service.initialize();
    addTearDown(service.dispose);
    var refreshCount = 0;
    int increment() => refreshCount++;
    await _pumpApp(tester, service, increment);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(refreshCount, 0);
  });

  testWidgets('OFFLINE → ONLINE → one refresh; duplicate events → no avalanche',
      (tester) async {
    final fake = _FakeConnectivity([ConnectivityResult.none]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    addTearDown(service.dispose);
    var refreshCount = 0;
    int increment() => refreshCount++;
    await _pumpApp(tester, service, increment);
    expect(refreshCount, 0);

    // The OFFLINE → ONLINE transition triggers exactly one batch.
    fake.emit([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump();
    expect(refreshCount, 1);

    // More transitions inside the debounce window → no new batches.
    fake.emit([ConnectivityResult.none]);
    fake.emit([ConnectivityResult.wifi]);
    fake.emit([ConnectivityResult.none]);
    fake.emit([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump();
    expect(refreshCount, 1);
  });
}