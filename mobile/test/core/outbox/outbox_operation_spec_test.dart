import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_operation_spec.dart';

void main() {
  group('OutboxOperationRegistry (Phase F3: spec-driven routing)', () {
    test('createSale is routed to POST /sales', () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.createSale);

      expect(spec, isNotNull);
      expect(spec!.endpoint, '/sales');
      expect(spec.endpoint, ApiEndpoints.sales);
    });

    test('registry covers every kind — no kind without a dispatch plan', () {
      // F4-B invariant: EVERY OutboxOperationKind has a registered spec, so
      // the worker's `spec == null → skip` guard can never fire for a known
      // kind. Keep in sync when a new kind is added in the future.
      for (final kind in OutboxOperationKind.values) {
        expect(
          OutboxOperationRegistry.specFor(kind),
          isNotNull,
          reason: 'kind "${kind.name}" must have a registered dispatch spec',
        );
      }
      // ...and the registry carries EXACTLY the declared kinds — no extras,
      // no fallback endpoints.
      expect(
        OutboxOperationRegistry.specs.keys.toSet(),
        OutboxOperationKind.values.toSet(),
      );
      expect(
        OutboxOperationRegistry.specs.length,
        OutboxOperationKind.values.length,
      );
    });

    test('createSale spec carries the chained DRAFT-complete follow-up', () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.createSale)!;

      expect(spec.chainedFollowUp, isNotNull);
    });
  });

  group('createSale chained follow-up (via spec — CREATE_SALE-specific)', () {
    final followUp = OutboxOperationRegistry
        .specFor(OutboxOperationKind.createSale)!.chainedFollowUp!;

    Future<List<String>> runHarness({
      Object? response,
      Object? completeError,
      void Function(String message)? onWarn,
    }) async {
      final paths = <String>[];
      await followUp(
        OutboxFollowUpContext(
          responseData: response,
          post: (path, {data}) async {
            paths.add(path);
            if (completeError != null) throw completeError;
            return const <String, dynamic>{};
          },
          warn: onWarn ?? (_) {},
        ),
      );
      return paths;
    }

    test('DRAFT sale is completed in the same burst', () async {
      final paths =
          await runHarness(response: {'id': 'sale-9', 'status': 'DRAFT'});

      expect(paths, ['/sales/sale-9/complete']);
    });

    test('non-DRAFT response → no chained call', () async {
      final paths = await runHarness(
        response: {'id': 'sale-9', 'status': 'COMPLETED'},
      );

      expect(paths, isEmpty);
    });

    test('missing / blank / non-string id → no chained call', () async {
      expect(await runHarness(response: {'status': 'DRAFT'}), isEmpty);
      expect(await runHarness(response: {'id': '', 'status': 'DRAFT'}),
          isEmpty);
      expect(await runHarness(response: {'id': 42, 'status': 'DRAFT'}),
          isEmpty);
    });

    test('non-map response → no chained call', () async {
      expect(await runHarness(response: 'ok'), isEmpty);
      expect(await runHarness(), isEmpty);
    });

    test('failed complete is reported via warn — never thrown (create stays '
        'confirmed)', () async {
      final warnings = <String>[];
      final paths = await runHarness(
        response: {'id': 'sale-10', 'status': 'DRAFT'},
        completeError: StateError('boom'),
        onWarn: warnings.add,
      );

      expect(paths, ['/sales/sale-10/complete']);
      expect(warnings, hasLength(1));
      expect(warnings.single, contains('sale-10'));
      expect(warnings.single, contains('DRAFT'));
    });
  });

  group('Phase F4-B: keyed mutation specs (cash / inventory / purchasing)', () {
    test('cashIn is routed to POST /sales/cash-shifts/cash-in', () {
      final spec = OutboxOperationRegistry.specFor(OutboxOperationKind.cashIn)!;

      expect(spec.endpoint, ApiEndpoints.cashShiftCashIn);
      expect(spec.endpoint, '/sales/cash-shifts/cash-in');
    });

    test('cashOut is routed to POST /sales/cash-shifts/cash-out', () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.cashOut)!;

      expect(spec.endpoint, ApiEndpoints.cashShiftCashOut);
      expect(spec.endpoint, '/sales/cash-shifts/cash-out');
    });

    test('adjustStock is routed to POST /inventory/stock/adjust', () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.adjustStock)!;

      expect(spec.endpoint, ApiEndpoints.stockAdjustments);
      expect(spec.endpoint, '/inventory/stock/adjust');
    });

    test('transferStock is routed to POST /inventory/stock/transfer', () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.transferStock)!;

      expect(spec.endpoint, ApiEndpoints.stockTransfers);
      expect(spec.endpoint, '/inventory/stock/transfer');
    });

    test('goodsReceipt is routed to POST /purchasing/goods-receipts', () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.goodsReceipt)!;

      expect(spec.endpoint, ApiEndpoints.goodsReceipt);
      expect(spec.endpoint, '/purchasing/goods-receipts');
    });

    test('cash specs lift warehouseId into the query WITHOUT mutating the '
        'payload', () {
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.cashIn,
        OutboxOperationKind.cashOut,
      ]) {
        final payload = <String, dynamic>{
          'amount': 100.0,
          'reason': 'petty cash',
          'warehouseId': 'warehouse-1',
        };
        final snapshot = Map<String, dynamic>.of(payload);

        final query =
            OutboxOperationRegistry.specFor(kind)!.buildQuery!(payload);

        expect(
          query,
          <String, dynamic>{'warehouseId': 'warehouse-1'},
          reason: '$kind must send warehouseId as a query parameter',
        );
        expect(
          payload,
          snapshot,
          reason: '$kind buildQuery must be pure — payload untouched',
        );
      }
    });

    test('bodyFor strips envelope-only query fields from the request body', () {
      // The backend ValidationPipe runs with forbidNonWhitelisted: true and
      // CashInOutDto whitelists only {amount, reason} — a body that still
      // carries the query-only warehouseId would be rejected with 400.
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.cashIn,
        OutboxOperationKind.cashOut,
      ]) {
        final spec = OutboxOperationRegistry.specFor(kind)!;
        final payload = <String, dynamic>{
          'amount': 100.0,
          'reason': 'petty cash',
          'warehouseId': 'warehouse-1',
        };
        final snapshot = Map<String, dynamic>.of(payload);

        final body = spec.bodyFor(payload);

        expect(
          body,
          <String, dynamic>{'amount': 100.0, 'reason': 'petty cash'},
          reason: '$kind body must contain only CashInOutDto fields',
        );
        expect(
          payload,
          snapshot,
          reason: '$kind bodyFor must be pure — payload untouched',
        );
      }
    });

    test('bodyFor leaves the body untouched when the envelope field is absent',
        () {
      const payload = <String, dynamic>{'amount': 5};

      final body = OutboxOperationRegistry
          .specFor(OutboxOperationKind.cashIn)!
          .bodyFor(payload);

      expect(body, payload);
    });

    test('bodyFor is the identity for kinds without query parameters', () {
      const payload = <String, dynamic>{'productId': 'p-1', 'quantity': 2};
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.createSale,
        OutboxOperationKind.adjustStock,
        OutboxOperationKind.transferStock,
        OutboxOperationKind.goodsReceipt,
      ]) {
        expect(
          OutboxOperationRegistry.specFor(kind)!.bodyFor(payload),
          same(payload),
          reason: '$kind must POST its payload verbatim as the body',
        );
      }
    });

    test('cash buildQuery tolerates a missing/blank/non-string warehouseId '
        'by producing no query (backend rejects → permanent, never guessed)',
        () {
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.cashIn,
        OutboxOperationKind.cashOut,
      ]) {
        final buildQuery =
            OutboxOperationRegistry.specFor(kind)!.buildQuery!;

        expect(
          buildQuery(const <String, dynamic>{'amount': 5}),
          isNull,
          reason: '$kind: missing warehouseId',
        );
        expect(
          buildQuery(const <String, dynamic>{'warehouseId': ''}),
          isNull,
          reason: '$kind: blank warehouseId',
        );
        expect(
          buildQuery(const <String, dynamic>{'warehouseId': 7}),
          isNull,
          reason: '$kind: non-string warehouseId',
        );
      }
    });

    test('inventory/purchasing kinds take no query parameters', () {
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.adjustStock,
        OutboxOperationKind.transferStock,
        OutboxOperationKind.goodsReceipt,
      ]) {
        expect(
          OutboxOperationRegistry.specFor(kind)!.buildQuery,
          isNull,
          reason: '$kind must POST its payload without a query string',
        );
      }
    });

    test('createSale spec is unchanged: /sales, no query, chained follow-up',
        () {
      final spec =
          OutboxOperationRegistry.specFor(OutboxOperationKind.createSale)!;

      expect(spec.endpoint, ApiEndpoints.sales);
      expect(spec.endpoint, '/sales');
      expect(spec.buildQuery, isNull);
      expect(spec.chainedFollowUp, isNotNull);
    });

    test('the chained follow-up exists ONLY on createSale', () {
      for (final kind in OutboxOperationKind.values) {
        final spec = OutboxOperationRegistry.specFor(kind)!;

        if (kind == OutboxOperationKind.createSale) {
          expect(spec.chainedFollowUp, isNotNull);
        } else {
          expect(
            spec.chainedFollowUp,
            isNull,
            reason: '$kind must not chain a follow-up',
          );
        }
      }
    });
  });
}