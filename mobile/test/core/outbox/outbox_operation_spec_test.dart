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
      for (final kind in OutboxOperationKind.values) {
        expect(
          OutboxOperationRegistry.specFor(kind),
          isNotNull,
          reason: 'kind "${kind.name}" must have a registered spec',
        );
      }
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
}