import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/features/settings/presentation/screens/settings_screen.dart';

void main() {
  testWidgets('Currency tile shows current currency and picker switches it',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentUserProvider.overrideWithValue(
            const CurrentUser(
              id: 'u1',
              email: 'alice@stockflow.test',
              firstName: 'Alice',
              lastName: 'Smith',
              companyId: 'c1',
            ),
          ),
        ],
        child: const MaterialApp(
          locale: Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: SettingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Tile defaults to KZT.
    expect(find.text('Currency'), findsOneWidget);
    expect(find.text('KZT ₸'), findsOneWidget);

    // Open the currency picker — all 8 backend codes listed.
    // (KZT ₸ appears twice while the dialog is open: tile subtitle + list item.)
    await tester.tap(find.text('Currency'));
    await tester.pumpAndSettle();
    expect(find.text('KZT ₸'), findsWidgets);
    expect(find.text('RUB ₽'), findsWidgets);
    expect(find.text(r'USD $'), findsWidgets);
    expect(find.text('EUR €'), findsWidgets);
    expect(find.text('CNY ¥'), findsWidgets);
    expect(find.text('AED د.إ'), findsWidgets);
    expect(find.text(r'AUD A$'), findsWidgets);
    expect(find.text('VND ₫'), findsWidgets);

    // Select RUB.
    await tester.tap(find.text('RUB ₽'));
    await tester.pumpAndSettle();

    final container =
        ProviderScope.containerOf(tester.element(find.byType(SettingsScreen)));
    expect(container.read(currencyProvider), 'RUB');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_currency'), 'RUB');
  });
}
