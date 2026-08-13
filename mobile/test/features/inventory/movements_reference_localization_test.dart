import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/inventory/presentation/screens/movements_screen.dart';

// ──────────────────────────────────
// Fake ApiClient — serves stock movements only
// ──────────────────────────────────
class _FakeMovementsApi extends ApiClient {
  _FakeMovementsApi() : super(tokenStorage: TokenStorage());

  List<Map<String, dynamic>> movements = [];

  Response<T> _respond<T>(dynamic data, String path) => Response<T>(
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
    if (path == '${ApiEndpoints.inventory}/stock/movements') {
      return _respond<T>(movements, path);
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

Map<String, dynamic> _movement(
  String id,
  String type,
  String? referenceType,
) =>
    {
      'id': id,
      'companyId': 'c1',
      'productId': 'p1',
      'warehouseId': 'w1',
      'type': type,
      'quantity': 5,
      'beforeQuantity': 10,
      'afterQuantity': 15,
      'referenceType': referenceType,
      'referenceId': 'r-$id',
      'comment': null,
      'createdBy': 'u1',
      'createdAt': '2026-08-01T10:00:00.000Z',
    };

void main() {
  Widget build(Locale locale, _FakeMovementsApi fake) {
    return ProviderScope(
      overrides: [apiClientProvider.overrideWith((ref) => fake)],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(body: MovementsScreen()),
      ),
    );
  }

  // Movements with every known referenceType + one unknown value.
  final allMovements = [
    _movement('m1', 'SALE', 'SALE'),
    _movement('m2', 'PURCHASE', 'PURCHASE'),
    _movement('m3', 'ADJUSTMENT', 'ADJUSTMENT'),
    _movement('m4', 'TRANSFER_IN', 'TRANSFER'),
    _movement('m5', 'RETURN', 'REFUND'),
    _movement('m6', 'PURCHASE', 'PURCHASE_RECEIPT'),
    _movement('m7', 'PURCHASE', 'PURCHASE_RETURN'),
    _movement('m8', 'ADJUSTMENT', 'RESERVATION'),
    _movement('m9', 'ADJUSTMENT', 'RELEASE'),
    _movement('m10', 'ADJUSTMENT', 'INVENTORY_COUNT'),
    _movement('m11', 'ADJUSTMENT', 'PRODUCT'),
    _movement('m12', 'ADJUSTMENT', 'CUSTOM_UNKNOWN'),
    _movement('m13', 'ADJUSTMENT', null),
  ];

  group('Movements Reference column — referenceType localization', () {
    testWidgets('EN keeps raw backend referenceType byte-for-byte',
        (tester) async {
      final fake = _FakeMovementsApi()..movements = allMovements;
      await tester.pumpWidget(build(const Locale('en'), fake));
      await tester.pumpAndSettle();

      for (final raw in [
        'SALE',
        'PURCHASE',
        'ADJUSTMENT',
        'TRANSFER',
        'REFUND',
        'PURCHASE_RECEIPT',
        'PURCHASE_RETURN',
        'RESERVATION',
        'RELEASE',
        'INVENTORY_COUNT',
        'PRODUCT',
        'CUSTOM_UNKNOWN',
      ]) {
        expect(find.text(raw), findsOneWidget,
            reason: 'EN Reference column must show raw "$raw" byte-for-byte');
      }
      // Localized titles must NOT leak into EN.
      expect(find.text('Поступление'), findsNothing);
      expect(find.text('Түсу'), findsNothing);
      // null referenceType renders the dash.
      expect(find.text('-'), findsOneWidget);
    });

    testWidgets('RU localizes known referenceType, raw fallback for unknown',
        (tester) async {
      final fake = _FakeMovementsApi()..movements = allMovements;
      await tester.pumpWidget(build(const Locale('ru'), fake));
      await tester.pumpAndSettle();

      final ruExpected = {
        'SALE': 'Продажа',
        'PURCHASE': 'Закупка',
        'ADJUSTMENT': 'Корректировка',
        'TRANSFER': 'Перевод',
        'REFUND': 'Возврат',
        'PURCHASE_RECEIPT': 'Поступление',
        'PURCHASE_RETURN': 'Возврат поставщику',
        'RESERVATION': 'Бронирование',
        'RELEASE': 'Снятие брони',
        'INVENTORY_COUNT': 'Инвентаризация',
        'PRODUCT': 'Начальный остаток',
      };
      for (final localized in ruExpected.values) {
        expect(find.text(localized), findsWidgets,
            reason: 'RU Reference column must localize "$localized"');
      }
      // No raw backend enums may surface in RU.
      for (final raw in ruExpected.keys) {
        expect(find.text(raw), findsNothing,
            reason: 'RU Reference column must not show raw "$raw"');
      }
      // Unknown referenceType keeps raw fallback.
      expect(find.text('CUSTOM_UNKNOWN'), findsOneWidget);
      expect(find.text('-'), findsOneWidget);
    });

    testWidgets('KK localizes known referenceType, raw fallback for unknown',
        (tester) async {
      final fake = _FakeMovementsApi()..movements = allMovements;
      await tester.pumpWidget(build(const Locale('kk'), fake));
      await tester.pumpAndSettle();

      final kkExpected = {
        'SALE': 'Сатылым',
        'PURCHASE': 'Сатып алу',
        'ADJUSTMENT': 'Түзету',
        'TRANSFER': 'Аударым',
        'REFUND': 'Қайтару',
        'PURCHASE_RECEIPT': 'Түсу',
        'PURCHASE_RETURN': 'Жеткізушіге қайтару',
        'RESERVATION': 'Брондау',
        'RELEASE': 'Бронды босату',
        'INVENTORY_COUNT': 'Түгендеу',
        'PRODUCT': 'Бастапқы қор',
      };
      for (final localized in kkExpected.values) {
        expect(find.text(localized), findsWidgets,
            reason: 'KK Reference column must localize "$localized"');
      }
      for (final raw in kkExpected.keys) {
        expect(find.text(raw), findsNothing,
            reason: 'KK Reference column must not show raw "$raw"');
      }
      expect(find.text('CUSTOM_UNKNOWN'), findsOneWidget);
      expect(find.text('-'), findsOneWidget);
    });
  });
}
