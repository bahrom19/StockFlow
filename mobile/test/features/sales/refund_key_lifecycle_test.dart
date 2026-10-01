import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// ApiClient is never exercised — the recording repository overrides
/// [SalesRepository.refund] entirely — but the parent constructor needs a
/// token storage (same pattern as sales_status_badge_test).
class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super(tokenStorage: TokenStorage());
}

/// Records every refund key routed through [PosNotifier.refundSale] and can
/// inject a mapped [Failure] to simulate backend outcomes.
class _RecordingRepo extends SalesRepository {
  _RecordingRepo() : super(_FakeApiClient());

  final keys = <String?>[];
  final items = <List<RefundItem>?>[];
  Failure? nextFailure;

  @override
  Future<SalesResult<void>> refund(
    String id, {
    RefundSaleRequest? request,
    String? idempotencyKey,
  }) async {
    keys.add(idempotencyKey);
    items.add(request?.items);
    final failure = nextFailure;
    if (failure != null) return SalesFailure(failure);
    return const SalesSuccess(null);
  }
}

Failure _networkFailure() => const NetworkFailure(
    message: 'Connection timeout. Please check your internet.');

/// G16-N-2 — refund idempotency-key lifecycle (Tests B and D).
///
/// One logical user refund confirmation = one immutable key: minted before
/// the first attempt, reused EXACTLY for every retry of that submit, cleared
/// on terminal outcomes so the next submission mints a fresh key.
void main() {
  late _RecordingRepo repo;
  late ProviderContainer container;
  late PosNotifier notifier;
  late String Function() savedIdGenerator;

  setUp(() {
    repo = _RecordingRepo();
    container = ProviderContainer(
      overrides: [salesRepositoryProvider.overrideWithValue(repo)],
    );
    notifier = container.read(posProvider.notifier);
    // Deterministic key material — same stubbing seam the outbox tests use.
    var seq = 0;
    savedIdGenerator = OutboxOperation.idGenerator;
    OutboxOperation.idGenerator = () => 'key-${++seq}';
  });

  tearDown(() {
    OutboxOperation.idGenerator = savedIdGenerator;
    container.dispose();
  });

  test('first refund attempt generates a key', () async {
    final error = await notifier.refundSale('s1');

    expect(error, isNull);
    expect(repo.keys.single, 'key-1');
  });

  test('retry after a transport failure reuses the EXACT same key', () async {
    repo.nextFailure = _networkFailure();
    await notifier.refundSale('s1');
    await notifier.refundSale('s1'); // user retry after timeout

    expect(repo.keys, hasLength(2));
    expect(repo.keys[1], repo.keys[0]); // same logical submission
  });

  test('successful refund clears the key; next submission mints a new one',
      () async {
    await notifier.refundSale('s1'); // success — terminal outcome
    await notifier.refundSale('s1'); // independent new submission

    expect(repo.keys, hasLength(2));
    expect(repo.keys[1], isNot(repo.keys[0]));
  });

  test('definitive (non-retryable) failure clears the key', () async {
    repo.nextFailure = const ValidationFailure(message: 'boom');
    await notifier.refundSale('s1'); // 4xx — submission rejected outright
    await notifier.refundSale('s1'); // fresh submission

    expect(repo.keys, hasLength(2));
    expect(repo.keys[1], isNot(repo.keys[0]));
  });

  test('409 conflict keeps the key — a retry replays the same reservation',
      () async {
    repo.nextFailure = const ConflictFailure(
        message: 'already being processed', code: '409');
    await notifier.refundSale('s1'); // same-key double-tap lost the race
    await notifier.refundSale('s1'); // retry must stay the SAME submission

    expect(repo.keys, hasLength(2));
    expect(repo.keys[1], repo.keys[0]);
  });

  test('beginRefundSubmit drops a held key (explicit new submission)',
      () async {
    repo.nextFailure = _networkFailure();
    await notifier.refundSale('s1');
    final held = repo.keys.single;

    notifier.beginRefundSubmit();
    await notifier.refundSale('s1');

    expect(repo.keys[1], isNot(held));
  });

  test('switching sales starts a clean submission context (cross-sale guard)',
      () async {
    repo.nextFailure = _networkFailure();
    await notifier.refundSale('s1'); // uncertain outcome — key held
    final held = repo.keys.single;

    await notifier.refundSale('s2'); // a different sale's refund

    expect(repo.keys[1], isNot(held));
  });

  test('partial refund items are forwarded to the repository', () async {
    const lines = [RefundItem(saleItemId: 'i1', quantity: 2)];

    await notifier.refundSale('s1', items: lines);

    expect(repo.items.single, lines);
  });

  test('returns the failure message on failure, null on success', () async {
    repo.nextFailure = const ValidationFailure(message: 'only 3 remaining');
    final error = await notifier.refundSale('s1');
    expect(error, 'only 3 remaining');

    repo.nextFailure = null;
    expect(await notifier.refundSale('s1'), isNull);
  });
}
