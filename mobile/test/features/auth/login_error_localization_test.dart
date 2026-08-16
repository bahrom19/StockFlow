import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';

/// Phase 5D-7A — login generic-error fallback localization.
///
/// The client-side fallbacks (`'Login failed'` / `'Login failed. Please check
/// your credentials.'`) are replaced by the existing `loginError` ARB key so
/// RU/KK users never see raw English on the generic error path. Backend
/// messages (`ApiFailure.error.message`) are intentionally untouched.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

/// AuthRepository whose [login] throws — the only way to exercise the
/// notifier's generic error path (the repository normally catches internally
/// and returns an `ApiFailure`).
class _ThrowingAuthRepo extends AuthRepository {
  _ThrowingAuthRepo(super.ref);

  @override
  Future<ApiResult<LoginResponse>> login({
    required String email,
    required String password,
  }) async {
    throw Exception('network down');
  }
}

void main() {
  group('login generic-error fallback localization', () {
    Future<String> genericErrorFor(AppLocalizations? l10n) async {
      final container = ProviderContainer(overrides: [
        authRepositoryProvider.overrideWith((ref) => _ThrowingAuthRepo(ref)),
      ]);
      addTearDown(container.dispose);

      await container.read(authStateProvider.notifier).login(
            email: 'a@b.c',
            password: 'x',
            l10n: l10n,
          );
      final state = container.read(authStateProvider);
      expect(state, isA<AuthError>());
      return (state as AuthError).message;
    }

    test('EN keeps the loginError display contract', () async {
      expect(await genericErrorFor(en()), 'Invalid email or password');
    });

    test('RU shows the localized message — no raw English fallback', () async {
      final message = await genericErrorFor(ru());
      expect(message, 'Неверный email или пароль');
      expect(message, isNot(contains('Login failed')));
      expect(message, isNot(contains('Invalid email or password')));
    });

    test('KK shows the localized message', () async {
      final message = await genericErrorFor(kk());
      expect(message, 'Қате email немесе құпия сөз');
    });

    test('null l10n falls back to the English default', () async {
      expect(await genericErrorFor(null), 'Invalid email or password');
    });
  });
}
