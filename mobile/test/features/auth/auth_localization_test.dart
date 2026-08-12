import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/auth/presentation/screens/login_screen.dart';
import 'package:stockflow/features/auth/presentation/screens/register_screen.dart';

/// Phase 1 localization smoke: the auth screens must render localized
/// strings under ru_RU and keep the original English strings under en_US
/// (the E2E contract runs on the en default).
void main() {
  Future<void> pumpScreen(WidgetTester tester, Widget screen, Locale locale) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          locale: locale,
          supportedLocales: const [Locale('en'), Locale('ru')],
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: screen,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('LoginScreen localization', () {
    testWidgets('renders English strings under en_US', (tester) async {
      await pumpScreen(tester, const LoginScreen(), const Locale('en'));

      expect(find.text('Sign In'), findsWidgets);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('New to StockFlow?'), findsOneWidget);
      expect(find.text('Create account'), findsOneWidget);
      // No Russian strings leak into the English UI.
      expect(find.text('Войти'), findsNothing);
      expect(find.text('Пароль'), findsNothing);
    });

    testWidgets('renders Russian strings under ru_RU', (tester) async {
      await pumpScreen(tester, const LoginScreen(), const Locale('ru'));

      expect(find.text('Войти'), findsWidgets);
      expect(find.text('Пароль'), findsOneWidget);
      expect(find.text('Впервые в StockFlow?'), findsOneWidget);
      expect(find.text('Создать аккаунт'), findsOneWidget);
      expect(find.text('Sign In'), findsNothing);
    });
  });

  group('RegisterScreen localization', () {
    testWidgets('renders English strings under en_US', (tester) async {
      await pumpScreen(tester, const RegisterScreen(), const Locale('en'));

      expect(find.text('Create your account'), findsOneWidget);
      expect(find.text('Company Name'), findsOneWidget);
      expect(find.text('Full Name'), findsOneWidget);
      expect(find.text('Confirm Password'), findsOneWidget);
      expect(find.text('Already have an account?'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Create Account'),
          findsOneWidget);
    });

    testWidgets('renders Russian strings under ru_RU', (tester) async {
      await pumpScreen(tester, const RegisterScreen(), const Locale('ru'));

      expect(find.text('Создайте свой аккаунт'), findsOneWidget);
      expect(find.text('Название компании'), findsOneWidget);
      expect(find.text('Имя и фамилия'), findsOneWidget);
      expect(find.text('Подтвердите пароль'), findsOneWidget);
      expect(find.text('Уже есть аккаунт?'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Создать аккаунт'),
          findsOneWidget);
      // No English strings leak into the Russian UI.
      expect(find.text('Create your account'), findsNothing);
    });

    testWidgets('shows localized validation message under ru_RU',
        (tester) async {
      await pumpScreen(tester, const RegisterScreen(), const Locale('ru'));

      // Weak password → localized "at least 8 characters" message.
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'TestCorp');
      await tester.enterText(fields.at(1), 'Jane Doe');
      await tester.enterText(fields.at(2), 'jane@stockflow.com');
      await tester.enterText(fields.at(3), 'weak');
      await tester.enterText(fields.at(4), 'weak');

      final button = find.widgetWithText(FilledButton, 'Создать аккаунт');
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();

      expect(find.text('Пароль должен содержать не менее 8 символов'),
          findsOneWidget);
    });
  });
}
