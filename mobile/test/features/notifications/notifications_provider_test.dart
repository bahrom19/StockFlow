import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/notifications/data/notifications_repository.dart';
import 'package:stockflow/features/notifications/domain/notification_models.dart';
import 'package:stockflow/features/notifications/presentation/providers/notifications_provider.dart';

/// Counting fake at the repository boundary — the notifier under test reads

/// [notificationsRepositoryProvider], so overriding that provider with this
/// fake keeps the tests free of any real Dio/network dependency.
class _FakeNotificationsRepository extends NotificationsRepository {
  _FakeNotificationsRepository() : super(_UnusedApiClient());

  int unreadCalls = 0;
  int listCalls = 0;
  int? nextUnreadCount = 7;
  bool failUnread = false;

  @override
  Future<NotificationsResult<int>> unreadCount() async {
    unreadCalls++;
    if (failUnread) {
      return const NotificationsFailure(
        ServerFailure(message: 'api down'),
      );
    }
    return NotificationsSuccess(nextUnreadCount ?? 0);
  }

  @override
  Future<NotificationsResult<NotificationListResponse>> list({
    int page = 1,
    int limit = 20,
    bool? unreadOnly,
    String? type,
  }) async {
    listCalls++;
    return const NotificationsFailure(
      ServerFailure(message: 'list is not stubbed'),
    );
  }

  @override
  Future<NotificationsResult<bool>> markRead(String id) async {
    return const NotificationsSuccess(true);
  }
}

class _UnusedApiClient extends ApiClient {
  _UnusedApiClient() : super(tokenStorage: TokenStorage());
}

UnreadCountState _unreadState(ProviderContainer container) =>
    container.read(unreadCountProvider);

void main() {
  late _FakeNotificationsRepository fakeRepo;
  late ProviderContainer container;

  setUp(() {
    fakeRepo = _FakeNotificationsRepository();
    container = ProviderContainer(
      overrides: [
        notificationsRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);
  });

  group('UnreadCountNotifier', () {
    test('initial state is Loading — no request before the lifecycle trigger',
        () {
      expect(_unreadState(container), isA<UnreadCountLoading>());
      expect(fakeRepo.unreadCalls, 0);
    });

    test('load() fetches once and lands in Loaded with the count', () async {
      await container.read(unreadCountProvider.notifier).load();

      expect(fakeRepo.unreadCalls, 1);
      expect(_unreadState(container), isA<UnreadCountLoaded>());
      expect((_unreadState(container) as UnreadCountLoaded).count, 7);
    });

    test('API error lands in UnreadCountError — state never throws', () async {
      fakeRepo.failUnread = true;

      await container.read(unreadCountProvider.notifier).load();

      expect(_unreadState(container), isA<UnreadCountError>());
    });

    test('refresh() refetches after a failure', () async {
      fakeRepo.failUnread = true;
      await container.read(unreadCountProvider.notifier).load();
      expect(_unreadState(container), isA<UnreadCountError>());

      fakeRepo.failUnread = false;
      await container.read(unreadCountProvider.notifier).refresh();

      expect(fakeRepo.unreadCalls, 2);
      expect(_unreadState(container), isA<UnreadCountLoaded>());
    });

    test('N5-1: ensureLoaded() is idempotent — no duplicate API requests',
        () async {
      final notifier = container.read(unreadCountProvider.notifier);
      await notifier.ensureLoaded();
      await notifier.ensureLoaded();
      await notifier.ensureLoaded();

      expect(fakeRepo.unreadCalls, 1);
      expect(_unreadState(container), isA<UnreadCountLoaded>());
    });

    test('N5-1: ensureLoaded() fetches exactly once while already in flight',
        () async {
      final notifier = container.read(unreadCountProvider.notifier);
      // Two concurrent ensureLoaded() calls on a fresh provider: the second
      // must observe UnreadCountLoading and skip instead of re-requesting.
      await Future.wait([
        notifier.ensureLoaded(),
        notifier.ensureLoaded(),
      ]);

      expect(fakeRepo.unreadCalls, 1);
    });

    test('N5-1: ensureLoaded() retries after an error state', () async {
      fakeRepo.failUnread = true;
      await container.read(unreadCountProvider.notifier).ensureLoaded();
      expect(_unreadState(container), isA<UnreadCountError>());

      fakeRepo.failUnread = false;
      await container.read(unreadCountProvider.notifier).ensureLoaded();

      expect(fakeRepo.unreadCalls, 2);
      expect(_unreadState(container), isA<UnreadCountLoaded>());
    });

    test('N5-1: reset() returns to the neutral Loading state', () async {
      await container.read(unreadCountProvider.notifier).load();
      expect(_unreadState(container), isA<UnreadCountLoaded>());

      container.read(unreadCountProvider.notifier).reset();

      expect(_unreadState(container), isA<UnreadCountLoading>());
    });

    test(
        'N5-1: logout resets the badge — the next session never sees the '
        'previous account count', () async {
      await container.read(unreadCountProvider.notifier).load();
      expect((_unreadState(container) as UnreadCountLoaded).count, 7);

      // Drive the real auth notifier into the unauthenticated state — exactly
      // the terminal state AuthStateNotifier.logout() ends with.
      container.read(authStateProvider.notifier).state =
          const AuthUnauthenticated();

      expect(_unreadState(container), isA<UnreadCountLoading>());
    });

    test(
        'N5-1: ensureLoaded() after logout-reset fetches again for the new '
        'session', () async {
      final notifier = container.read(unreadCountProvider.notifier);
      await notifier.load();
      container.read(authStateProvider.notifier).state =
          const AuthUnauthenticated();
      fakeRepo.nextUnreadCount = 3;

      await notifier.ensureLoaded();

      expect(fakeRepo.unreadCalls, 2);
      expect((_unreadState(container) as UnreadCountLoaded).count, 3);
    });
  });

  group('NotificationsListNotifier — existing behaviour untouched', () {
    test('list failure keeps the list in Error state without crashing',
        () async {
      await container
          .read(notificationsListProvider.notifier)
          .loadNotifications();

      expect(container.read(notificationsListProvider),
          isA<NotificationsListError>());
      expect(fakeRepo.listCalls, 1);
      expect(fakeRepo.unreadCalls, 0, reason: 'list must not touch the badge');
    });
  });
}
