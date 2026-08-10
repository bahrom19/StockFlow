import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/purchasing/presentation/screens/purchase_order_form_screen.dart';

// ─────────────────────────────────────────────────────────────
// PurchaseOrderFormScreen — "Items" header semantics regression
// guard.
//
// The Items row mixes non-interactive text (`Text('Items')`) with an
// interactive `TextButton.icon('Add Item')`. Before the fix, Flutter Web
// hoisted "Items" into the row's role="group" aria-label (the
// f72701d/ddd97fb flattening class), hiding the header from
// document.body.innerText.
//
// The fix wraps ONLY the text in a label-less Semantics(container: true)
// boundary; the Add Item button stays a separate sibling. This test locks
// that contract:
//   - "Items" is its own non-interactive semantics leaf;
//   - "Add Item" remains a separate interactive node;
//   - tapping Add Item still adds a line card (outcome preserved).
// ─────────────────────────────────────────────────────────────
class _FakePoFormApi extends ApiClient {
  _FakePoFormApi() : super(tokenStorage: TokenStorage());

  Response<T> _ok<T>(dynamic data, String path) => Response<T>(
        data: data,
        statusCode: 200,
        requestOptions: RequestOptions(path: path),
      );

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    if (path == '/suppliers') {
      // Empty supplier list keeps the dropdown items empty — the Items row
      // renders regardless of supplier data.
      return _ok<T>({
        'items': <Object>[],
        'total': 0,
        'page': 1,
        'limit': 20,
      }, path);
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

Future<void> _pumpScreen(WidgetTester tester) async {
  final container = ProviderContainer(overrides: [
    apiClientProvider.overrideWith((ref) => _FakePoFormApi()),
  ]);
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: PurchaseOrderFormScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('PurchaseOrderForm Items header semantics boundary', () {
    testWidgets('"Items" is its own non-tappable semantics leaf',
        (tester) async {
      await _pumpScreen(tester);

      final handle = tester.ensureSemantics();

      final itemsData =
          tester.getSemantics(find.text('Items')).getSemanticsData();
      expect(itemsData.label, contains('Items'));
      expect(itemsData.hasAction(SemanticsAction.tap), isFalse);

      handle.dispose();
    });

    testWidgets('Add Item remains a separate tappable node', (tester) async {
      await _pumpScreen(tester);

      final handle = tester.ensureSemantics();

      final addData =
          tester.getSemantics(find.text('Add Item')).getSemanticsData();
      expect(addData.label, contains('Add Item'));
      expect(addData.hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
    });

    testWidgets('tapping Add Item still adds a line card (outcome preserved)',
        (tester) async {
      await _pumpScreen(tester);

      // No line items yet — the Product/Qty/Unit Cost fields are absent.
      expect(find.text('Product'), findsNothing);

      await tester.tap(find.text('Add Item'));
      await tester.pumpAndSettle();

      // One line card with Product/Qty/Unit Cost fields appeared.
      expect(find.text('Product'), findsOneWidget);
      expect(find.text('Qty'), findsOneWidget);
      expect(find.text('Unit Cost'), findsOneWidget);
    });
  });
}
