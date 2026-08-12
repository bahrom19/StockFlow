import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/localization/locale_provider.dart';
import 'package:stockflow/features/settings/presentation/screens/settings_screen.dart';

void main() {
  testWidgets('Language tile shows current locale and picker switches it',
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
        child: const MaterialApp(home: SettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    // Tile defaults to English.
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);

    // Open the language picker.
    await tester.tap(find.text('Language'));
    await tester.pumpAndSettle();
    expect(find.text('Русский'), findsOneWidget);
    expect(find.text('Қазақша'), findsOneWidget);

    // Select Russian.
    await tester.tap(find.text('Русский'));
    await tester.pumpAndSettle();

    // Locale switched to ru and persisted.
    final container =
        ProviderScope.containerOf(tester.element(find.byType(SettingsScreen)));
    expect(container.read(localeProvider), const Locale('ru'));
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_locale'), 'ru');
  });
}
