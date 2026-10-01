import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/currency/money.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/held_sales_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// G16-N-3 P1 — Held Sales tenant/user isolation.
///
/// Security invariant under test:
///   A held sale owned by (companyId=A, userId=X) is NEVER observable,
///   loadable, resumable or discardable by any session whose
///   (companyId, userId) differs — across logout/login, account switch,
///   company switch, ProviderScope survival, app restart and legacy
///   pre-scope storage.
///
/// The lifecycle is driven through the REAL [AuthStateNotifier] (stubbed
/// token storage + auth repository), so the production logout/login path and
/// the `ref.listen` wiring under test are the ones that actually ship.

// ──────────────────────────────────
// Test doubles
// ──────────────────────────────────

/// Never touches the network or platform channels.
class _StubTokenStorage extends TokenStorage {
  String? _refresh;

  @override
  Future<String?> getRefreshToken() async => _refresh;

  @override
  Future<bool> hasTokens() async => _refresh != null;

  @override
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async =>
      _refresh = refreshToken;

  @override
  Future<void> clearTokens() async => _refresh = null;
}

/// Hands back whichever user the test declares, so login-as-Y is a real
/// auth transition rather than a provider override that skips the listener.
class _ScriptedAuthRepository extends AuthRepository {
  _ScriptedAuthRepository(super.ref, this.nextUser);

  CurrentUser nextUser;

  @override
  Future<ApiResult<LoginResponse>> login({
    required String email,
    required String password,
  }) async {
    return ApiSuccess(
      LoginResponse(
        accessToken: 'access-$email',
        refreshToken: 'refresh-$email',
        user: nextUser,
      ),
    );
  }

  @override
  Future<ApiResult<void>> logout({String? refreshTokenValue}) async =>
      const ApiSuccess(null);
}

CurrentUser _user(String companyId, String userId) => CurrentUser(
      id: userId,
      email: '$userId@$companyId.test',
      companyId: companyId,
    );

const _companyA = 'company-A';
const _companyB = 'company-B';
const _userX = 'user-X';
const _userY = 'user-Y';

CartState _cart({String? customerId, String? customerName}) => CartState(
      items: const [
        CartItem(
          productId: 'p1',
          productName: 'Espresso',
          productSku: 'ESP',
          quantity: 2,
          unitPrice: Money(minorUnits: 1000, currency: 'KZT'),
          costPrice: Money(minorUnits: 500, currency: 'KZT'),
        ),
      ],
      customerId: customerId,
      customerName: customerName,
    );

/// A container wired exactly like production: the warmed [PreferencesStorage]
/// over mocked SharedPreferences, a stubbed token store and a scripted auth
/// repository, with the real [AuthStateNotifier] driving the transitions.
ProviderContainer _container(PreferencesStorage prefs) {
  final container = ProviderContainer(
    overrides: [
      outboxStorageProvider.overrideWithValue(OutboxStorage(prefs)),
      tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
      authRepositoryProvider.overrideWith(
        (ref) => _ScriptedAuthRepository(ref, _user(_companyA, _userX)),
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Future<void> _loginAs(
  ProviderContainer container,
  CurrentUser user,
) async {
  final repo = container.read(authRepositoryProvider) as _ScriptedAuthRepository;
  repo.nextUser = user;
  await container
      .read(authStateProvider.notifier)
      .login(email: user.email, password: 'pw');
}

Future<void> _logout(ProviderContainer container) =>
    container.read(authStateProvider.notifier).logout();

String? _raw(
  PreferencesStorage prefs,
  String companyId,
  String userId,
) =>
    prefs.getString(HeldSalesNotifier.scopedStorageKey(companyId, userId));

void main() {
  late PreferencesStorage prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = PreferencesStorage();
    await prefs.initialize();
  });

  // ──────────────────────────────────
  // Core scenario A–E
  // ──────────────────────────────────
  group('G16-N-3 P1 — core cross-user isolation (A–E)', () {
    test('A/B: X holds a sale, logout purges memory but keeps storage',
        () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));

      // A. X holds a sale.
      await container
          .read(heldSalesProvider.notifier)
          .hold(_cart(customerId: 'cust-1', customerName: 'Anna'),
              label: 'X hold');
      expect(container.read(heldSalesProvider).held, hasLength(1));
      expect(_raw(prefs, _companyA, _userX), isNotNull,
          reason: 'X drafts must stay persisted for X');

      // B. X logs out.
      await _logout(container);

      // In-memory list is gone (the ProviderScope-survival hole is closed)…
      expect(container.read(heldSalesProvider).held, isEmpty);
      // …but the at-rest partition for X is deliberately retained.
      expect(_raw(prefs, _companyA, _userX), isNotNull);
      expect(_raw(prefs, _companyA, _userY), isNull);
    });

    test('C/D/E: Y cannot see and cannot resume X\'s held sale', () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container
          .read(heldSalesProvider.notifier)
          .hold(_cart(customerId: 'cust-1', customerName: 'Anna'),
              label: 'X hold');
      final xId = container.read(heldSalesProvider).held.single.id;

      await _logout(container);

      // C. Y (same company, different user) logs in.
      await _loginAs(container, _user(_companyA, _userY));

      // D. Y cannot SEE it.
      await container.read(heldSalesProvider.notifier).load();
      expect(container.read(heldSalesProvider).held, isEmpty);
      expect(_raw(prefs, _companyA, _userY), isNull,
          reason: "Y's partition must never contain X's draft");

      // E. Y cannot RESUME it — and does not consume it.
      final resumed = await container.read(heldSalesProvider.notifier).resume(xId);
      expect(resumed, isNull);
      expect(_raw(prefs, _companyA, _userX), isNotNull,
          reason: 'a blocked resume must not delete the record');

      // …and no foreign customer/product data reached the active POS cart.
      final cart = container.read(cartProvider);
      expect(cart.customerId, isNull);
      expect(cart.customerName, isNull);
      expect(cart.items, isEmpty);
    });
  });

  // ──────────────────────────────────
  // Attribution
  // ──────────────────────────────────
  group('G16-N-3 P1 — record attribution', () {
    test('hold() stamps the authenticated company/user onto the record',
        () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).hold(_cart());

      final saved = container.read(heldSalesProvider).held.single;
      expect(saved.companyId, _companyA);
      expect(saved.userId, _userX);
      expect(saved.schemaVersion, HeldSale.currentSchemaVersion);

      final json =
          (jsonDecode(_raw(prefs, _companyA, _userX)!) as List).first as Map;
      expect(json['companyId'], _companyA);
      expect(json['userId'], _userX);
      expect(json['schemaVersion'], HeldSale.currentSchemaVersion);
    });

    test('hold() without an authenticated user fails closed, persisting '
        'nothing', () async {
      final container = _container(prefs);
      // No login at all — the session is unauthenticated.
      expect(
        () => container.read(heldSalesProvider.notifier).hold(_cart()),
        throwsA(isA<StateError>()),
      );
      expect(container.read(heldSalesProvider).held, isEmpty);
      // No partition of any kind may exist after a refused hold.
      expect(_raw(prefs, _companyA, _userX), isNull);
      expect(_raw(prefs, _companyA, _userY), isNull);
      expect(prefs.getString(HeldSalesNotifier.legacyStorageKey), isNull);
    });
  });

  // ──────────────────────────────────
  // Cross-company
  // ──────────────────────────────────
  group('G16-N-3 P1 — cross-company isolation', () {
    test('company B cannot see or resume company A\'s held sale', () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).hold(_cart());
      final xId = container.read(heldSalesProvider).held.single.id;

      await _logout(container);
      await _loginAs(container, _user(_companyB, _userY));

      await container.read(heldSalesProvider.notifier).load();
      expect(container.read(heldSalesProvider).held, isEmpty);
      expect(await container.read(heldSalesProvider.notifier).resume(xId),
          isNull);
      expect(_raw(prefs, _companyB, _userY), isNull);
      expect(_raw(prefs, _companyA, _userX), isNotNull);
    });

    test('both partitions coexist and stay independent', () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).hold(_cart());
      await _logout(container);

      await _loginAs(container, _user(_companyB, _userY));
      await container.read(heldSalesProvider.notifier).hold(_cart());
      await container.read(heldSalesProvider.notifier).load();
      expect(container.read(heldSalesProvider).held, hasLength(1));

      expect(_raw(prefs, _companyA, _userX), isNotNull);
      expect(_raw(prefs, _companyB, _userY), isNotNull);

      // Each partition holds exactly one record — no co-location.
      expect((jsonDecode(_raw(prefs, _companyA, _userX)!) as List), hasLength(1));
      expect((jsonDecode(_raw(prefs, _companyB, _userY)!) as List), hasLength(1));
    });
  });

  // ──────────────────────────────────
  // Stale ProviderScope — the mandatory regression test
  // ──────────────────────────────────
  group('G16-N-3 P1 — stale ProviderScope regression', () {
    test('X holds → logout → Y authenticates → held list is empty WITHOUT '
        'any manual load, and resume(X_ID) returns null', () async {
      final container = _container(prefs);
      // Make the providers live up-front (the POS screen does this on mount).
      container.read(heldSalesProvider);
      container.read(cartProvider);

      await _loginAs(container, _user(_companyA, _userX));
      container.read(cartProvider.notifier).addItem(
            const CartItem(
              productId: 'p1',
              productName: 'Espresso',
              productSku: 'ESP',
              quantity: 1,
              unitPrice: Money(minorUnits: 1000, currency: 'KZT'),
              costPrice: Money(minorUnits: 500, currency: 'KZT'),
            ),
          );
      container.read(cartProvider.notifier).setCustomer('cust-1', 'Anna');
      await container.read(heldSalesProvider.notifier).hold(_cart());
      final xId = container.read(heldSalesProvider).held.single.id;
      expect(container.read(heldSalesProvider).held, hasLength(1));

      await _logout(container);
      await _loginAs(container, _user(_companyA, _userY));

      // NO load() call anywhere in this block — the assertion below must hold
      // purely from the auth listener. A load-only filter fails here.
      expect(container.read(heldSalesProvider).held, isEmpty,
          reason: 'stale in-memory drafts must not survive an identity change');
      expect(await container.read(heldSalesProvider.notifier).resume(xId),
          isNull);

      // The active cart must be empty too — no customerId/customerName/items.
      final cart = container.read(cartProvider);
      expect(cart.items, isEmpty);
      expect(cart.customerId, isNull);
      expect(cart.customerName, isNull);
    });

    test('the active cart is cleared on logout even with no held sales',
        () async {
      final container = _container(prefs);
      container.read(cartProvider);
      await _loginAs(container, _user(_companyA, _userX));
      container.read(cartProvider.notifier).addItem(
            const CartItem(
              productId: 'p1',
              productName: 'Espresso',
              productSku: 'ESP',
              quantity: 3,
              unitPrice: Money(minorUnits: 1000, currency: 'KZT'),
              costPrice: Money(minorUnits: 500, currency: 'KZT'),
            ),
          );
      container.read(cartProvider.notifier).setCustomer('cust-9', 'Bob');
      expect(container.read(cartProvider).items, hasLength(1));

      await _logout(container);

      final cart = container.read(cartProvider);
      expect(cart.items, isEmpty);
      expect(cart.customerId, isNull);
      expect(cart.customerName, isNull);

      await _loginAs(container, _user(_companyB, _userY));
      expect(container.read(cartProvider).items, isEmpty);
    });
  });

  // ──────────────────────────────────
  // Restart
  // ──────────────────────────────────
  group('G16-N-3 P1 — app restart', () {
    test('a fresh provider over the same storage is scoped, not global',
        () async {
      final session1 = _container(prefs);
      await _loginAs(session1, _user(_companyA, _userX));
      await session1.read(heldSalesProvider.notifier).hold(_cart());
      await _logout(session1);
      session1.dispose();

      // Restart as Y — brand-new container, same on-disk storage.
      final session2 = _container(prefs);
      await _loginAs(session2, _user(_companyA, _userY));
      await session2.read(heldSalesProvider.notifier).load();
      expect(session2.read(heldSalesProvider).held, isEmpty);
    });

    test('after restart the ORIGINAL owner still sees and resumes own drafts',
        () async {
      final session1 = _container(prefs);
      await _loginAs(session1, _user(_companyA, _userX));
      await session1.read(heldSalesProvider.notifier)
          .hold(_cart(customerId: 'cust-1', customerName: 'Anna'),
              label: 'X hold');
      await _logout(session1);
      session1.dispose();

      final session2 = _container(prefs);
      await _loginAs(session2, _user(_companyA, _userX));
      await session2.read(heldSalesProvider.notifier).load();
      final held = session2.read(heldSalesProvider).held;
      expect(held, hasLength(1));
      expect(held.single.label, 'X hold');

      final resumed =
          await session2.read(heldSalesProvider.notifier).resume(held.single.id);
      expect(resumed, isNotNull);
      expect(resumed!.customerId, 'cust-1');
      expect(resumed.customerName, 'Anna');
    });

    test('unauthenticated session loads nothing at all', () async {
      final session1 = _container(prefs);
      await _loginAs(session1, _user(_companyA, _userX));
      await session1.read(heldSalesProvider.notifier).hold(_cart());

      // Brand-new container that never logs in.
      final session2 = _container(prefs);
      await session2.read(heldSalesProvider.notifier).load();
      expect(session2.read(heldSalesProvider).held, isEmpty,
          reason: 'unauthenticated load must fail closed');
    });
  });

  // ──────────────────────────────────
  // Legacy data
  // ──────────────────────────────────
  group('G16-N-3 P1 — legacy held_sales_v1 disposal', () {
    test('legacy unscoped records are deleted, never imported, never visible',
        () async {
      // A pre-G16-N-3 payload: no companyId / userId / schemaVersion at all.
      final legacy = <Map<String, dynamic>>[
        {
          'id': 'legacy-1',
          'label': 'Old hold',
          'heldAt': '2026-01-01T00:00:00.000Z',
          'currency': 'KZT',
          'customerId': 'cust-legacy',
          'customerName': 'Legacy Customer',
          'items': [
            {
              'productId': 'p9',
              'productName': 'Legacy Item',
              'productSku': 'LEG',
              'quantity': 1,
              'unitPrice': '10.00',
              'costPrice': '4.00',
              'discount': '0',
              'currency': 'KZT',
            },
          ],
        },
        {
          'id': 'legacy-2',
          'label': 'Another old hold',
          'heldAt': DateTime.utc(2026, 1, 2).toIso8601String(),
          'currency': 'KZT',
          'items': const [],
        },
      ];
      SharedPreferences.setMockInitialValues({
        HeldSalesNotifier.legacyStorageKey: jsonEncode(legacy),
      });
      prefs = PreferencesStorage();
      await prefs.initialize();

      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).load();

      // Invisible to the very first user after the upgrade — ownership is
      // never inferred from the current login.
      expect(container.read(heldSalesProvider).held, isEmpty);

      // The legacy key is gone, and nothing was migrated into X's partition.
      expect(prefs.getString(HeldSalesNotifier.legacyStorageKey), isNull);
      expect(_raw(prefs, _companyA, _userX), isNull);
    });

    test('the legacy key is never written again', () async {
      SharedPreferences.setMockInitialValues({
        HeldSalesNotifier.legacyStorageKey: jsonEncode([
          {'id': 'legacy-1', 'label': 'x', 'items': const []},
        ]),
      });
      prefs = PreferencesStorage();
      await prefs.initialize();

      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).load();
      await container.read(heldSalesProvider.notifier).hold(_cart());
      await container.read(heldSalesProvider.notifier).discard(
            container.read(heldSalesProvider).held.single.id,
          );

      expect(prefs.getString(HeldSalesNotifier.legacyStorageKey), isNull);
    });

    test('a record inside a scoped partition with foreign scope is dropped',
        () async {
      // Hand-craft a poisoned partition: correct key for Y, but the record
      // claims to belong to X.
      SharedPreferences.setMockInitialValues({
        HeldSalesNotifier.scopedStorageKey(_companyA, _userY): jsonEncode([
          {
            'id': 'poison',
            'label': 'Poisoned',
            'heldAt': '2026-02-01T00:00:00.000Z',
            'currency': 'KZT',
            'items': const [],
            'companyId': _companyA,
            'userId': _userX,
            'schemaVersion': HeldSale.currentSchemaVersion,
          },
        ]),
      });
      prefs = PreferencesStorage();
      await prefs.initialize();

      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userY));
      await container.read(heldSalesProvider.notifier).load();

      expect(container.read(heldSalesProvider).held, isEmpty,
          reason: 'per-record ownership must be re-verified on every load');
    });

    test('a record with an unknown schemaVersion is dropped', () async {
      SharedPreferences.setMockInitialValues({
        HeldSalesNotifier.scopedStorageKey(_companyA, _userX): jsonEncode([
          {
            'id': 'future',
            'label': 'From a newer build',
            'heldAt': '2026-03-01T00:00:00.000Z',
            'currency': 'KZT',
            'items': const [],
            'companyId': _companyA,
            'userId': _userX,
            'schemaVersion': HeldSale.currentSchemaVersion + 1,
          },
        ]),
      });
      prefs = PreferencesStorage();
      await prefs.initialize();

      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).load();
      expect(container.read(heldSalesProvider).held, isEmpty);
    });
  });

  // ──────────────────────────────────
  // Same-user behaviour preserved
  // ──────────────────────────────────
  group('G16-N-3 P1 — preserved same-user behaviour', () {
    test('multiple held sales keep newest-first order across a reload',
        () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      final notifier = container.read(heldSalesProvider.notifier);
      await notifier.hold(_cart(), label: 'First');
      await notifier.hold(_cart(), label: 'Second');
      await notifier.hold(_cart(), label: 'Third');

      expect(
        container.read(heldSalesProvider).held.map((h) => h.label).toList(),
        ['Third', 'Second', 'First'],
      );

      // Force a genuine re-read from storage for the SAME scope.
      final container2 = _container(prefs);
      await _loginAs(container2, _user(_companyA, _userX));
      await container2.read(heldSalesProvider.notifier).load();
      expect(
        container2.read(heldSalesProvider).held.map((h) => h.label).toList(),
        ['Third', 'Second', 'First'],
      );
    });

    test('same-user resume restores items and customer, and empties storage',
        () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container
          .read(heldSalesProvider.notifier)
          .hold(_cart(customerId: 'cust-1', customerName: 'Anna'),
              label: 'Mine');

      final id = container.read(heldSalesProvider).held.single.id;
      final resumed =
          await container.read(heldSalesProvider.notifier).resume(id);

      expect(resumed, isNotNull);
      expect(resumed!.items, hasLength(1));
      expect(resumed.items.single.productName, 'Espresso');
      expect(resumed.items.single.costPrice,
          const Money(minorUnits: 500, currency: 'KZT'));
      expect(resumed.customerId, 'cust-1');
      expect(resumed.customerName, 'Anna');
      expect(container.read(heldSalesProvider).held, isEmpty);
      expect(jsonDecode(_raw(prefs, _companyA, _userX)!) as List, isEmpty);
    });

    test('discard removes only the caller\'s own record', () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      final notifier = container.read(heldSalesProvider.notifier);
      await notifier.hold(_cart(), label: 'X one');
      await notifier.hold(_cart(), label: 'X two');

      await _logout(container);
      await _loginAs(container, _user(_companyA, _userY));
      await notifier.hold(_cart(), label: 'Y one');

      // Y discards her own record — X's are untouched.
      final yId =
          container.read(heldSalesProvider).held.firstWhere((h) => h.label == 'Y one').id;
      await container.read(heldSalesProvider.notifier).discard(yId);

      final xLabels =
          (jsonDecode(_raw(prefs, _companyA, _userX)!) as List)
              .map((e) => (e as Map)['label'])
              .toList();
      expect(xLabels, containsAll(['X one', 'X two']));
      expect(container.read(heldSalesProvider).held, isEmpty);
    });

    test('a full company/user switch round-trip returns X\'s drafts intact',
        () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container
          .read(heldSalesProvider.notifier)
          .hold(_cart(customerId: 'cust-1', customerName: 'Anna'),
              label: 'X hold');

      await _logout(container);
      await _loginAs(container, _user(_companyB, _userY));
      await container.read(heldSalesProvider.notifier).load();
      expect(container.read(heldSalesProvider).held, isEmpty);

      await _logout(container);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(heldSalesProvider.notifier).load();
      final held = container.read(heldSalesProvider).held;
      expect(held, hasLength(1));
      expect(held.single.label, 'X hold');
      expect(held.single.customerName, 'Anna');

      final resumed =
          await container.read(heldSalesProvider.notifier).resume(held.single.id);
      expect(resumed, isNotNull);
      expect(resumed!.customerId, 'cust-1');
    });
  });

  // The outbox must remain untouched by this change.
  group('G16-N-3 P1 — G16-N-2 baseline untouched', () {
    test('logout still wipes the outbox alongside the held-sales purge',
        () async {
      final container = _container(prefs);
      await _loginAs(container, _user(_companyA, _userX));
      await container.read(outboxControllerProvider.notifier).hydrate();
      await container
          .read(heldSalesProvider.notifier)
          .hold(_cart(), label: 'X hold');

      await _logout(container);

      expect(container.read(outboxControllerProvider).operations, isEmpty);
      expect(container.read(heldSalesProvider).held, isEmpty);
      // The outbox storage key is the pre-existing one, not the new one.
      expect(prefs.getString(HeldSalesNotifier.legacyStorageKey), isNull);
    });
  });
}
