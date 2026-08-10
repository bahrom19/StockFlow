import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/widgets/premium_empty_state.dart';

// ── P1 semantics boundary (ddd97fb pattern) ─────────────────────────────
// PremiumEmptyState wraps its title + description in a label-less
// Semantics(container: true) so Flutter Web serializes them as textContent
// (document.body.innerText) instead of hoisting them into the group's
// aria-label because of the interactive CTA. The CTA stays a sibling.
//
// Because both texts live inside the SAME Semantics(container: true), Flutter
// merges them into ONE leaf whose label contains title + description; the
// CTA remains a separate tappable node.
void main() {
  Widget wrap({VoidCallback? onCta}) => MaterialApp(
        home: Scaffold(
          body: PremiumEmptyState(
            icon: Icons.inbox_outlined,
            color: Colors.blue,
            title: 'No data here',
            description: 'Start by adding your first record.',
            ctaLabel: 'Create',
            ctaIcon: Icons.add,
            onCta: onCta,
          ),
        ),
      );

  testWidgets('title + description merged into one leaf, CTA separate tappable',
      (tester) async {
    await tester.pumpWidget(wrap(onCta: () {}));
    // Proven pattern (cash_drawer_hero_test): enable semantics AFTER pump so
    // the tree is built with the semantics owner attached.
    final handle = tester.ensureSemantics();

    // The merged leaf (anchored on the title text) carries BOTH title and
    // description, and is NON-interactive (no tap action).
    final leafData =
        tester.getSemantics(find.text('No data here')).getSemanticsData();
    expect(leafData.label, contains('No data here'));
    expect(leafData.label, contains('Start by adding your first record.'));
    expect(leafData.hasAction(SemanticsAction.tap), isFalse);

    // CTA remains a separate tappable node.
    final ctaData =
        tester.getSemantics(find.text('Create')).getSemanticsData();
    expect(ctaData.hasAction(SemanticsAction.tap), isTrue);

    handle.dispose();
  });

  testWidgets('CTA still fires its callback', (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(onCta: () => tapped = true));
    await tester.tap(find.text('Create'));
    await tester.pump();
    expect(tapped, isTrue);
  });
}
