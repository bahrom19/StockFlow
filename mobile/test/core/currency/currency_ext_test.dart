import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

/// Probes the currency accessors inside the scope.
class _Probe extends StatelessWidget {
  final dynamic amount;
  const _Probe({required this.amount});

  @override
  Widget build(BuildContext context) {
    return Text(
      '${context.currencyCode}|${context.currencySymbol}|'
      '${context.money(amount)}|${context.moneyShort(1500000)}',
    );
  }
}

void main() {
  testWidgets('CurrencyScope propagates code/symbol/money accessors',
      (tester) async {
    await tester.pumpWidget(
      const CurrencyScope(
        code: 'RUB',
        child: MaterialApp(home: Scaffold(body: _Probe(amount: 1234.5))),
      ),
    );
    expect(find.text('RUB|₽|₽1,234.50|₽1.5M'), findsOneWidget);
  });

  testWidgets('scope change rebuilds dependents', (tester) async {
    Widget build(String code) => CurrencyScope(
          code: code,
          child: MaterialApp(home: Scaffold(body: _Probe(amount: 100))),
        );

    await tester.pumpWidget(build('KZT'));
    expect(find.text('KZT|₸|₸100.00|₸1.5M'), findsOneWidget);

    await tester.pumpWidget(build('USD'));
    expect(find.text(r'USD|$|$100.00|$1.5M'), findsOneWidget);
  });

  testWidgets('falls back to KZT without a scope', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: _Probe(amount: 200))),
    );
    expect(find.text('KZT|₸|₸200.00|₸1.5M'), findsOneWidget);
  });

  testWidgets('moneyShort applies RU compact suffixes from the UI locale',
      (tester) async {
    await tester.pumpWidget(
      const CurrencyScope(
        code: 'RUB',
        child: MaterialApp(
          locale: Locale('ru'),
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: [Locale('ru')],
          home: Scaffold(body: _Probe(amount: 1234.5)),
        ),
      ),
    );
    expect(find.text('RUB|₽|₽1,234.50|₽1.5млн'), findsOneWidget);
  });

  testWidgets('CurrencyScope.of throws outside the tree', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    final context = tester.element(find.byType(MaterialApp));
    expect(() => CurrencyScope.of(context), throwsFlutterError);
  });
}
