import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/services/connectivity_service.dart';

/// Fake plugin facade: scripted [checkConnectivity] + manual event source.
class _FakeConnectivity implements Connectivity {
  _FakeConnectivity(this.initial);

  List<ConnectivityResult> initial;
  final _controller = StreamController<List<ConnectivityResult>>.broadcast();
  int events = 0;

  void emit(List<ConnectivityResult> results) {
    events++;
    _controller.add(results);
  }

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async => initial;

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      _controller.stream;
}

Future<List<bool>> _collect(ConnectivityService service, int max) async {
  final events = <bool>[];
  final sub = service.statusStream.listen(events.add);
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
  await sub.cancel();
  assert(events.length <= max, 'too many events: $events');
  return events;
}

void main() {
  test('initialize maps initial connectivity to ONLINE state', () async {
    final fake = _FakeConnectivity([ConnectivityResult.wifi]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    expect(service.isOnline, isTrue);
    expect(await _collect(service, 1), [true]);
    service.dispose();
  });

  test('initialize maps offline (none) to OFFLINE state', () async {
    final fake = _FakeConnectivity([ConnectivityResult.none]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    expect(service.isOnline, isFalse);
    expect(await _collect(service, 1), [false]);
    service.dispose();
  });

  test('ONLINE → OFFLINE → ONLINE transitions are emitted', () async {
    final fake = _FakeConnectivity([ConnectivityResult.wifi]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    final events = <bool>[];
    final sub = service.statusStream.listen(events.add);
    await Future<void>.delayed(Duration.zero);

    fake.emit([ConnectivityResult.none]);
    await Future<void>.delayed(Duration.zero);
    expect(service.isOnline, isFalse);

    fake.emit([ConnectivityResult.mobile]);
    await Future<void>.delayed(Duration.zero);
    expect(service.isOnline, isTrue);

    await sub.cancel();
    // Exactly: initial replay + 2 transitions — no duplicates.
    expect(events, [true, false, true]);
    service.dispose();
  });

  test('duplicate identical connectivity events are NOT re-emitted', () async {
    final fake = _FakeConnectivity([ConnectivityResult.wifi]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    final events = <bool>[];
    final sub = service.statusStream.listen(events.add);
    await Future<void>.delayed(Duration.zero);

    // Several plugin events, all still ONLINE → state must stay silent.
    fake.emit([ConnectivityResult.wifi]);
    fake.emit([ConnectivityResult.ethernet]);
    fake.emit([ConnectivityResult.mobile]);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    await sub.cancel();
    expect(fake.events, 3);
    expect(events, [true]); // only the initial replay
    service.dispose();
  });

  test('dispose closes the stream and tolerates repeated dispose', () async {
    final fake = _FakeConnectivity([ConnectivityResult.none]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    service.dispose();
    expect(() => service.dispose(), returnsNormally);
    // Late plugin event after dispose must not crash.
    expect(() => fake.emit([ConnectivityResult.wifi]), returnsNormally);
  });

  test('riverpod status provider mirrors service transitions', () async {
    final fake = _FakeConnectivity([ConnectivityResult.none]);
    final service = ConnectivityService(connectivity: fake);
    await service.initialize();
    final container = ProviderContainer(overrides: [
      connectivityServiceProvider.overrideWithValue(service),
    ]);
    addTearDown(container.dispose);
    // The notifier is seeded from service.isOnline (offline here).
    expect(container.read(connectivityStatusProvider), isFalse);
    Future<void> settle() => Future<void>.delayed(Duration.zero);
    fake.emit([ConnectivityResult.wifi]);
    await settle();
    await settle();
    expect(container.read(connectivityStatusProvider), isTrue);
    fake.emit([ConnectivityResult.none]);
    await settle();
    await settle();
    expect(container.read(connectivityStatusProvider), isFalse);
    service.dispose();
  });
}