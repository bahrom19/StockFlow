import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';

/// Never touches the network or the platform channels.
class _StubTokenStorage extends TokenStorage {
  @override
  Future<String?> getRefreshToken() async => null;

  @override
  Future<void> clearTokens() async {}
}

class _StubAuthRepository extends AuthRepository {
  _StubAuthRepository(Ref ref) : super(ref);

  @override
  Future<ApiResult<void>> logout({String? refreshTokenValue}) async {
    return const ApiSuccess(null);
  }
}

OutboxOperation _saleOp() {
  return OutboxOperation(
    clientOperationId: 'logout-op-1',
    kind: OutboxOperationKind.createSale,
    companyId: 'company-1',
    userId: 'user-1',
    payload: const {'saleNumber': 'OFF-logout'},
    createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('logout → outbox is wiped from memory AND persistence', () async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final outbox = OutboxController(OutboxStorage(prefs));

    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
        authRepositoryProvider.overrideWith(
          (ref) => _StubAuthRepository(ref),
        ),
        outboxControllerProvider.overrideWith((ref) => outbox),
      ],
    );
    addTearDown(container.dispose);

    // An offline sale is queued before logout.
    await container
        .read(outboxControllerProvider.notifier)
        .enqueue(_saleOp());
    expect(container.read(outboxControllerProvider).operations, hasLength(1));

    await container.read(authStateProvider.notifier).logout();

    // Memory is empty…
    expect(container.read(outboxControllerProvider).operations, isEmpty);
    // …and persistence is empty: a fresh controller hydrates nothing.
    final fresh = OutboxController(OutboxStorage(prefs));
    await fresh.hydrate();
    expect(fresh.state.operations, isEmpty);
  });

  test('logout with an empty queue stays a no-op for the outbox', () async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final outbox = OutboxController(OutboxStorage(prefs));

    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
        authRepositoryProvider.overrideWith(
          (ref) => _StubAuthRepository(ref),
        ),
        outboxControllerProvider.overrideWith((ref) => outbox),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authStateProvider.notifier).logout();

    expect(
      container.read(authStateProvider),
      isA<AuthUnauthenticated>(),
    );
    expect(container.read(outboxControllerProvider).operations, isEmpty);
  });
}