import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/app.dart';
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

Future<ConnectivityService> _service(
    List<ConnectivityResult> initial) async {
  final fake = _FakeConnectivity(initial);
  final service = ConnectivityService(connectivity: fake);
  await service.initialize();
  return service;
}

Widget _wrap(ConnectivityService service, Widget child) {
  return ProviderScope(
    overrides: [connectivityServiceProvider.overrideWithValue(service)],
    child: MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ru'), Locale('kk')],
      home: OfflineBannerScope(child: child),
    ),
  );
}

void main() {
  testWidgets('OFFLINE → compact banner is shown, content stays interactive',
      (tester) async {
    final service = await _service([ConnectivityResult.none]);
    addTearDown(service.dispose);
    await tester.pumpWidget(_wrap(
      service,
      const Scaffold(body: Center(child: Text('content'))),
    ));
    await tester.pumpAndSettle();
    expect(find.text('No Internet Connection'), findsOneWidget);
    expect(find.text('content'), findsOneWidget);
  });

  testWidgets('OFFLINE → ONLINE → banner disappears', (tester) async {
    final fake = _FakeConnectivity([ConnectivityResult.none]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    addTearDown(service.dispose);
    await tester.pumpWidget(_wrap(
      service,
      const Scaffold(body: Center(child: Text('content'))),
    ));
    await tester.pumpAndSettle();
    expect(find.text('No Internet Connection'), findsOneWidget);

    fake.emit([ConnectivityResult.wifi]);
    await tester.pumpAndSettle();
    expect(find.text('No Internet Connection'), findsNothing);
    expect(find.text('content'), findsOneWidget);
  });

  testWidgets('ONLINE from the start → no banner at all', (tester) async {
    final service = await _service([ConnectivityResult.wifi]);
    addTearDown(service.dispose);
    await tester.pumpWidget(_wrap(
      service,
      const Scaffold(body: Center(child: Text('content'))),
    ));
    await tester.pumpAndSettle();
    expect(find.text('No Internet Connection'), findsNothing);
  });
}