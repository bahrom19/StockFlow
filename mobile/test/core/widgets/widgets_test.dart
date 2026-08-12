import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/loading_state_widget.dart';
import 'package:stockflow/core/widgets/offline_state_widget.dart';

void main() {
  group('ErrorStateWidget', () {
    testWidgets('should display error message', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ErrorStateWidget(
              message: 'Test error message',
              onRetry: () {},
            ),
          ),
        ),
      );

      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Test error message'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);
    });

    testWidgets('should not show retry button when onRetry is null', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ErrorStateWidget(message: 'Test error'),
          ),
        ),
      );

      expect(find.text('Try Again'), findsNothing);
    });
  });

  group('EmptyStateWidget', () {
    testWidgets('should display empty state message', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmptyStateWidget(
              title: 'No items found',
              subtitle: 'Add your first item to get started',
            ),
          ),
        ),
      );

      expect(find.text('No items found'), findsOneWidget);
      expect(find.text('Add your first item to get started'), findsOneWidget);
    });
  });

  group('LoadingStateWidget', () {
    testWidgets('should display loading indicator', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const LoadingStateWidget(message: 'Loading...'),
          ),
        ),
      );

      expect(find.text('Loading...'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('OfflineStateWidget', () {
    testWidgets('should display offline message', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OfflineStateWidget(onRetry: () {}),
          ),
        ),
      );

      expect(find.text('No Internet Connection'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
