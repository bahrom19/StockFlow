import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';
import 'package:stockflow/features/payments/presentation/providers/payment_analytics_provider.dart';
import 'package:stockflow/features/payments/presentation/screens/payment_analytics_screen.dart';

// ─────────────────────────────────────────────────────────────
// PaymentAnalyticsScreen — _ChartCard semantics regression guard.
//
// The "Payment Comparison" card mixes non-interactive text (title +
// subtitle) with an interactive trailing _MetricToggle (SegmentedButton).
// Before the fix, Flutter Web hoisted the whole card into one
// role="group" aria-label, hiding "Payment Comparison" / "By Amount"
// from document.body.innerText (the f72701d/ddd97fb flattening class).
//
// The fix wraps the title/subtitle Expanded(Column) in a label-less
// Semantics(container: true) boundary; the toggle stays a separate
// sibling. This test locks that contract:
//   - title/subtitle are their own non-interactive leaf;
//   - the metric toggle remains a separate interactive node;
//   - switching the metric still updates the subtitle.
// ─────────────────────────────────────────────────────────────
class _FakeAnalyticsNotifier extends PaymentAnalyticsNotifier {
  _FakeAnalyticsNotifier(super.ref);

  @override
  Future<void> load({PaymentPeriod? period}) async {
    state = PaymentAnalyticsLoaded(_data);
  }

  static final _data = PaymentAnalyticsData(
    period: PaymentPeriod.month,
    from: DateTime(2026, 7, 12),
    to: DateTime(2026, 8, 10, 23, 59, 59),
    totalRevenue: 2400,
    totalTransactions: 5,
    methods: const [
      PaymentMethodStat(
        code: 'CASH',
        label: 'Cash',
        amount: 1500,
        percent: 62.5,
        count: 3,
        averageTicket: 500,
      ),
      PaymentMethodStat(
        code: 'CARD',
        label: 'Card',
        amount: 900,
        percent: 37.5,
        count: 2,
        averageTicket: 450,
      ),
    ],
    dailyTrend: const [],
  );
}

Future<void> _pumpScreen(WidgetTester tester) async {
  final container = ProviderContainer(overrides: [
    paymentAnalyticsProvider
        .overrideWith((ref) => _FakeAnalyticsNotifier(ref)),
  ]);
  addTearDown(container.dispose);

  // Large surface so the whole analytics ListView fits without scrolling —
  // the comparison card is the last chart card.
  tester.view.physicalSize = const Size(1440, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: PaymentAnalyticsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('PaymentAnalytics _ChartCard semantics boundary', () {
    testWidgets('title + subtitle are their own leaf without a tap action',
        (tester) async {
      await _pumpScreen(tester);

      final handle = tester.ensureSemantics();

      final titleData = tester
          .getSemantics(find.text('Payment Comparison'))
          .getSemanticsData();
      expect(titleData.label, contains('Payment Comparison'));
      expect(titleData.hasAction(SemanticsAction.tap), isFalse);

      final subData =
          tester.getSemantics(find.text('By Amount')).getSemanticsData();
      expect(subData.label, contains('By Amount'));
      expect(subData.hasAction(SemanticsAction.tap), isFalse);

      handle.dispose();
    });

    testWidgets('metric toggle remains a separate interactive node',
        (tester) async {
      await _pumpScreen(tester);

      final handle = tester.ensureSemantics();

      // The segment text is its own node — NOT merged into the card's
      // title/subtitle leaf (the f72701d/ddd97fb rule).
      final segData =
          tester.getSemantics(find.text('Amount')).getSemanticsData();
      expect(segData.label, contains('Amount'));
      expect(segData.hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
    });

    testWidgets('switching the metric updates the subtitle', (tester) async {
      await _pumpScreen(tester);

      expect(find.text('By Amount'), findsOneWidget);

      await tester.tap(find.text('Transactions'));
      await tester.pumpAndSettle();

      expect(find.text('By Amount'), findsNothing);
      expect(find.text('By Transactions'), findsOneWidget);
    });

    testWidgets('cards without a trailing widget keep their text in a leaf',
        (tester) async {
      await _pumpScreen(tester);

      final handle = tester.ensureSemantics();

      // "Payment Distribution" has no trailing widget — its title must still
      // be a plain text leaf (it was already SAFE; guard against regressions).
      final distData = tester
          .getSemantics(find.text('Payment Distribution'))
          .getSemanticsData();
      expect(distData.label, contains('Payment Distribution'));
      expect(distData.hasAction(SemanticsAction.tap), isFalse);

      handle.dispose();
    });
  });
}
