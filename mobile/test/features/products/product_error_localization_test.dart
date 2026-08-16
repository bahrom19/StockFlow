import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';

/// Phase 5D-7A — product detail load-error fallback localization.
///
/// The client-side fallback (`'Failed to load'`) is replaced by the existing
/// `failedToLoadProduct` ARB key so RU/KK users never see raw English on the
/// generic load-error path. Backend messages (`ProductsFail.error.message`)
/// are intentionally untouched.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

/// ProductsRepository whose [getById] throws — exercises the notifier's
/// unexpected-error path (the repository normally catches internally and
/// returns a `ProductsFail`).
class _ThrowingProductsRepo extends ProductsRepository {
  _ThrowingProductsRepo(super.ref);

  @override
  Future<ProductsResult<Product>> getById(String id) async {
    throw Exception('network down');
  }
}

void main() {
  group('product detail load-error fallback localization', () {
    Future<String> loadErrorFor(AppLocalizations? l10n) async {
      final container = ProviderContainer(overrides: [
        productsRepositoryProvider.overrideWith((ref) => _ThrowingProductsRepo(ref)),
      ]);
      addTearDown(container.dispose);

      await container
          .read(productDetailProvider('p1').notifier)
          .loadProduct('p1', l10n: l10n);
      final state = container.read(productDetailProvider('p1'));
      expect(state, isA<ProductDetailError>());
      return (state as ProductDetailError).message;
    }

    test('EN keeps the failedToLoadProduct display contract', () async {
      expect(await loadErrorFor(en()), 'Failed to load product');
    });

    test('RU shows the localized message — no raw English fallback', () async {
      final message = await loadErrorFor(ru());
      expect(message, 'Не удалось загрузить товар');
      expect(message, isNot(contains('Failed to load')));
    });

    test('KK shows the localized message', () async {
      final message = await loadErrorFor(kk());
      expect(message, 'Тауарды жүктеу сәтсіз');
    });

    test('null l10n falls back to the English default', () async {
      expect(await loadErrorFor(null), 'Failed to load product');
    });
  });
}
