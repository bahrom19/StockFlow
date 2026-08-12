import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/recent_sales_list.dart';

// ── P1 semantics boundary (ddd97fb pattern) ─────────────────────────────
// RecentSalesList wraps its "Recent Sales" header text in a label-less
// Semantics(container: true) so Flutter Web serializes it as textContent
// (document.body.innerText) instead of hoisting it into the row's
// role="group" aria-label because of the interactive "View all" button.
void main() {
  RecentSale sale(String num) => RecentSale(
        id: num,
        saleNumber: num,
        createdAt: '2026-08-10T10:00:00.000Z',
        status: 'COMPLETED',
        total: '15000.0000',
        paidAmount: '15000.0000',
      );

  Widget wrap(List<RecentSale> sales) => MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: RecentSalesList(sales: sales),
        ),
      );

  testWidgets('header text is its own leaf, View all separate tappable',
      (tester) async {
    await tester.pumpWidget(wrap([sale('SALE-1')]));
    // Proven pattern (cash_drawer_hero_test): enable semantics AFTER pump so
    // the tree is built with the semantics owner attached.
    final handle = tester.ensureSemantics();

    // "Recent Sales" carries its own label on a NON-interactive node.
    final titleData =
        tester.getSemantics(find.text('Recent Sales')).getSemanticsData();
    expect(titleData.label, contains('Recent Sales'));
    expect(titleData.hasAction(SemanticsAction.tap), isFalse);

    // "View all" remains a separate tappable node.
    final viewAllData =
        tester.getSemantics(find.text('View all')).getSemanticsData();
    expect(viewAllData.hasAction(SemanticsAction.tap), isTrue);

    handle.dispose();
  });

  testWidgets('sale rows still render their texts', (tester) async {
    await tester.pumpWidget(wrap([sale('SALE-1'), sale('SALE-2')]));
    expect(find.text('SALE-1'), findsOneWidget);
    expect(find.text('SALE-2'), findsOneWidget);
  });
}
