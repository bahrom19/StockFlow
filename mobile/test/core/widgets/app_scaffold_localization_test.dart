import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/widgets/app_scaffold.dart';

void main() {
  group('AppScaffold empty fallback (noData)', () {
    testWidgets('uses localized noData when emptyTitle is null', (tester) async {
      final expected = <String, String>{
        'en': 'No data',
        'ru': 'Нет данных',
        'kk': 'Деректер жоқ',
      };
      for (final entry in expected.entries) {
        await tester.pumpWidget(
          MaterialApp(
            locale: Locale(entry.key),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: AppScaffold(
                child: const SizedBox.shrink(),
                isEmpty: true,
              ),
            ),
          ),
        );
        expect(find.text(entry.value), findsOneWidget);
      }
    });
  });
}
