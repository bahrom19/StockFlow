import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/shell/app_top_bar.dart';
import 'package:stockflow/features/notifications/data/notifications_repository.dart';

/// Repository fake — the real unreadCountProvider keeps its production wiring
/// (including the N5-1 logout reset listener), only the repository boundary
/// is replaced, so the widget test exercises the REAL bell lifecycle.
class _FakeNotificationsRepository extends NotificationsRepository {
  _FakeNotificationsRepository() : super(_UnusedApiClient());

  int unreadCalls = 0;
  int nextUnreadCount = 0;

  @override
  Future<NotificationsResult<int>> unreadCount() async {
    unreadCalls++;
    return NotificationsSuccess(nextUnreadCount);
  }
}

class _UnusedApiClient extends ApiClient {
  _UnusedApiClient() : super(tokenStorage: TokenStorage());
}

Future<void> _pumpTopBar(
  WidgetTester tester,
  _FakeNotificationsRepository repo,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(
          const CurrentUser(id: 'u1', email: 'u@stockflow.test', companyId: 'c1'),
        ),
        notificationsRepositoryProvider.overrideWithValue(repo),
      ],
      child: const MaterialApp(
        locale: Locale('en', 'US'),
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Scaffold(body: AppTopBar(currentLocation: '/dashboard')),
      ),
    ),
  );
  // Flush the bell initState microtask + the fake fetch.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 10));
}

Badge _bellBadge(WidgetTester tester) =>
    tester.widget<Badge>(find.byType(Badge).first);

void main() {
  testWidgets('N5-1: bell initState performs the initial unread-count load',
      (tester) async {
    final repo = _FakeNotificationsRepository()..nextUnreadCount = 5;

    await _pumpTopBar(tester, repo);

    expect(repo.unreadCalls, 1, reason: 'exactly one initial load per session');
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('count = 0 → badge exists but label is not visible',
      (tester) async {
    final repo = _FakeNotificationsRepository()..nextUnreadCount = 0;

    await _pumpTopBar(tester, repo);

    expect(repo.unreadCalls, 1);
    expect(find.byType(Badge), findsWidgets);
    expect(_bellBadge(tester).isLabelVisible, isFalse);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('count > 0 → badge shows the exact count', (tester) async {
    final repo = _FakeNotificationsRepository()..nextUnreadCount = 5;

    await _pumpTopBar(tester, repo);

    expect(_bellBadge(tester).isLabelVisible, isTrue);
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('count > 99 → legacy "99+" label behaviour is preserved',
      (tester) async {
    final repo = _FakeNotificationsRepository()..nextUnreadCount = 150;

    await _pumpTopBar(tester, repo);

    expect(_bellBadge(tester).isLabelVisible, isTrue);
    expect(find.text('99+'), findsOneWidget);
    expect(find.text('150'), findsNothing);
  });

  testWidgets(
      'N5-1: re-mounted bell does NOT duplicate the request (idempotent '
      'ensureLoaded)', (tester) async {
    final repo = _FakeNotificationsRepository()..nextUnreadCount = 5;

    await _pumpTopBar(tester, repo);
    expect(repo.unreadCalls, 1);

    // Simulate a shell re-mount (e.g. layout-branch switch): a brand-new
    // bell element triggers ensureLoaded again — the provider must skip it.
    await _pumpTopBar(tester, repo);

    expect(repo.unreadCalls, 1);
    expect(find.text('5'), findsOneWidget);

    // Tear down the tree so the live-status timer is cancelled.
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
