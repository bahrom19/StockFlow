import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Connectivity Service Provider.
///
/// The single app instance is created in `main()` (awaited `initialize`) and
/// injected here via `ProviderScope.overrides` — everything in the app
/// (status provider, offline banner, lifecycle refresh) must observe THE
/// SAME service. The fallback body below exists for tests/standalone use and
/// lazily initializes its own instance, so it is never a dead stub.
final connectivityServiceProvider = Provider<ConnectivityService>((ref) {
  final service = ConnectivityService();
  ref.onDispose(service.dispose);
  unawaited(service.initialize());
  return service;
});

/// Reactive ONLINE/OFFLINE status for the UI — `true` = online.
/// Driven by the single [connectivityServiceProvider] instance.
final connectivityStatusProvider =
    StateNotifierProvider<ConnectivityStatusNotifier, bool>((ref) {
  return ConnectivityStatusNotifier(ref.watch(connectivityServiceProvider));
});

/// Bridges [ConnectivityService.statusStream] into Riverpod state so widgets
/// can simply `ref.watch(connectivityStatusProvider)`.
class ConnectivityStatusNotifier extends StateNotifier<bool> {
  StreamSubscription<bool>? _subscription;

  ConnectivityStatusNotifier(ConnectivityService service)
      : super(service.isOnline) {
    _subscription = service.statusStream.listen((online) {
      if (mounted) state = online;
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _subscription = null;
    super.dispose();
  }
}

/// Service to monitor internet connectivity status.
class ConnectivityService {
  /// [connectivity] is optional and allows tests to inject a fake plugin
  /// facade instead of touching platform channels.
  ConnectivityService({Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;
  final StreamController<bool> _statusController =
      StreamController<bool>.broadcast();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  /// Last value pushed to [statusStream]; `null` before the first emission.
  bool? _lastEmitted;
  bool _isOnline = true;
  bool _disposed = false;

  bool get isOnline => _isOnline;

  /// ONLINE/OFFLINE state stream.
  ///
  /// Semantics: every NEW listener synchronously receives the current state
  /// first (replay-at-listen), then forwards every subsequent TRANSITION.
  /// Duplicate plugin events with an unchanged value are suppressed by
  /// [_update], so listeners observe clean OFFLINE→ONLINE / ONLINE→OFFLINE
  /// transitions and never a storm of identical events.
  ///
  /// Implemented as a custom [Stream] (NOT an `async*` getter): an `async*`
  /// relay reaches its internal `yield*` subscription only after a microtask,
  /// so events emitted in that window would be silently dropped by the
  /// broadcast source. Here the replay and the source subscription both happen
  /// synchronously inside `onListen`, leaving no such window.
  Stream<bool> get statusStream => _StatusStream(
        () => _lastEmitted ?? _isOnline,
        _statusController.stream,
      );

  /// Raw plugin events mapped to bools (every event, even unchanged ones).
  Stream<bool> get onConnectivityChanged {
    return _connectivity.onConnectivityChanged.map(
      (results) => results.any((r) => r != ConnectivityResult.none),
    );
  }

  Future<void> initialize() async {
    final results = await _connectivity.checkConnectivity();
    _update(results.any((r) => r != ConnectivityResult.none));
    _subscription ??= _connectivity.onConnectivityChanged.listen((results) {
      _update(results.any((r) => r != ConnectivityResult.none));
    });
  }

  void _update(bool online) {
    _isOnline = online;
    if (_disposed || _lastEmitted == online) return;
    _lastEmitted = online;
    if (!_statusController.isClosed) _statusController.add(online);
  }

  void dispose() {
    _disposed = true;
    _subscription?.cancel();
    _subscription = null;
    _statusController.close();
  }
}

/// Multicast "state stream": replays the current value to each new listener
/// synchronously (inside `onListen`, BEFORE subscribing to the source) and
/// then forwards source events. This removes the subscription lag an
/// `async*` relay would have, during which broadcast events could be lost.
class _StatusStream extends Stream<bool> {
  _StatusStream(this._current, this._source);

  final bool Function() _current;
  final Stream<bool> _source;

  @override
  StreamSubscription<bool> listen(
    void Function(bool event)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) {
    late final StreamController<bool> controller;
    StreamSubscription<bool>? sourceSub;
    controller = StreamController<bool>(
      sync: true,
      onListen: () {
        // 1) Replay the current state synchronously to this listener.
        controller.add(_current());
        // 2) Only then start forwarding source transitions.
        sourceSub = _source.listen(
          controller.add,
          onError: onError,
          onDone: onDone,
          cancelOnError: cancelOnError,
        );
      },
      onPause: () => sourceSub?.pause(),
      onResume: () => sourceSub?.resume(),
      onCancel: () => sourceSub?.cancel(),
    );
    return controller.stream.listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }
}
