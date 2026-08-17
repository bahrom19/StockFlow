import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/presentation/screens/supplier_form_screen.dart';

/// Phase 5C — supplier form failure snackbar localization.
///
/// The form previously rendered `error.message` raw, showing the canonical
/// English ErrorHandler fallback to RU/KK users. It now routes through
/// `localizedErrorLabel`. Guard 1: EN keeps the canonical text. Guard 2:
/// RU/KK localize known canonical messages. Guard 3: arbitrary
/// backend/freeform messages pass through unchanged.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

class _FakeSuppliersRepo extends SuppliersRepository {
  _FakeSuppliersRepo(super.api, super.ref, this.message);
  final String message;

  @override
  Future<SuppliersResult<Supplier>> create(
      CreateSupplierRequest request) async {
    return SuppliersFailure(NetworkFailure(message: message));
  }
}

Future<void> pumpAndSubmit(
  WidgetTester tester, {
  required Locale locale,
  required String canonical,
  required String expected,
}) async {
  // Tall surface so the whole form (save button at the bottom of the
  // ListView) is inflated — lazy slivers skip below-fold children otherwise.
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  final api = ApiClient(tokenStorage: TokenStorage());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        suppliersRepositoryProvider.overrideWith(
            (ref) => _FakeSuppliersRepo(api, ref, canonical)),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const SupplierFormScreen(),
      ),
    ),
  );
  await tester.enterText(find.byType(TextFormField).first, 'Test Supplier');
  await tester.pumpAndSettle();
  await tester.tap(find.byType(FilledButton));
  await tester.pumpAndSettle();

  expect(find.text(expected), findsOneWidget,
      reason: 'supplier form, ${locale.languageCode}: expected snackbar');
  // No raw-leak guard for RU/KK known messages.
  if (expected != canonical) {
    expect(find.text(canonical), findsNothing,
        reason: 'raw canonical must not leak in ${locale.languageCode}');
  }
}

void main() {
  group('Supplier form failure snackbar localization', () {
    testWidgets('EN keeps the canonical text', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('en'),
        canonical: ErrorMessages.connectionTimeout,
        expected: ErrorMessages.connectionTimeout,
      );
    });

    testWidgets('RU localizes connection timeout', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('ru'),
        canonical: ErrorMessages.connectionTimeout,
        expected: 'Превышено время ожидания. Проверьте интернет-соединение.',
      );
    });

    testWidgets('KK localizes connection timeout', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('kk'),
        canonical: ErrorMessages.connectionTimeout,
        expected: 'Қосылу уақыты аяқталды. Интернет байланысын тексеріңіз.',
      );
    });

    testWidgets('RU localizes no-internet canonical', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('ru'),
        canonical: ErrorMessages.noInternet,
        expected: 'Нет подключения к интернету. Проверьте сеть.',
      );
    });

    testWidgets('freeform backend message passes through in RU',
        (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('ru'),
        canonical: 'Backend rejected the request',
        expected: 'Backend rejected the request',
      );
    });
  });
}
