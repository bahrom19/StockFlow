import 'dart:async' show unawaited;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/company/company_provider.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';

// ──────────────────────────────────
// Auth State
// ──────────────────────────────────
sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final CurrentUser user;
  const AuthAuthenticated(this.user);
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);
}

// ──────────────────────────────────
// Auth Notifier
// ──────────────────────────────────
class AuthStateNotifier extends StateNotifier<AuthState> {
  final Ref _ref;
  final AppLogger _logger = AppLogger('AuthState');

  AuthStateNotifier(this._ref) : super(const AuthInitial());

  bool get isAuthenticated => state is AuthAuthenticated;
  CurrentUser? get currentUser =>
      state is AuthAuthenticated ? (state as AuthAuthenticated).user : null;

  Future<void> checkAuthStatus() async {
    final storage = _ref.read(tokenStorageProvider);
    final hasTokens = await storage.hasTokens();
    if (!hasTokens) {
      state = const AuthUnauthenticated();
      return;
    }

    state = const AuthLoading();
    try {
      // Deployed backend has no GET /auth/me — restore the session via the
      // refresh flow, which returns the user profile with new tokens.
      await _tryRestoreFromRefresh(storage);
    } catch (e) {
      _logger.error('Auto-login failed', e);
      await storage.clearTokens();
      state = const AuthUnauthenticated();
    }
  }

  Future<void> _tryRestoreFromRefresh(TokenStorage storage) async {
    final refreshTokenValue = await storage.getRefreshToken();
    if (refreshTokenValue == null || refreshTokenValue.isEmpty) {
      await storage.clearTokens();
      state = const AuthUnauthenticated();
      return;
    }

    try {
      final repo = _ref.read(authRepositoryProvider);
      final result = await repo.refreshToken(refreshTokenValue: refreshTokenValue);
      if (result is ApiSuccess<RefreshResponse>) {
        state = AuthAuthenticated(result.data.user);
        _loadCompanyData();
      } else {
        await storage.clearTokens();
        state = const AuthUnauthenticated();
      }
    } catch (_) {
      await storage.clearTokens();
      state = const AuthUnauthenticated();
    }
  }

  /// Fetches the company data (authoritative `Company.currency`) right after
  /// the session is established. Fire-and-forget: while the request is in
  /// flight, CurrencyProvider serves the SharedPreferences warm cache.
  void _loadCompanyData() {
    unawaited(
      _ref
          .read(companyProvider.notifier)
          .load(_ref.read(apiClientProvider)),
    );
  }

  Future<void> login({
    required String email,
    required String password,
    AppLocalizations? l10n,
  }) async {
    state = const AuthLoading();
    try {
      final repo = _ref.read(authRepositoryProvider);
      final result = await repo.login(email: email, password: password);

      if (result is ApiSuccess<LoginResponse>) {
        // Persist tokens immediately so session restore (checkAuthStatus)
        // can validate on app restart / F5 without a fresh login.
        final storage = _ref.read(tokenStorageProvider);
        await storage.saveTokens(
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
        );
        state = AuthAuthenticated(result.data.user);
        _loadCompanyData();
      } else {
        final message = result is ApiFailure<LoginResponse>
            ? result.error.message
            : (l10n?.loginError ?? 'Invalid email or password');
        state = AuthError(message);
      }
    } catch (e) {
      _logger.error('Login failed', e);
      state = AuthError(l10n?.loginError ?? 'Invalid email or password');
    }
  }

  /// G16-N-3 P2-B-4 Phase 3 — sign out.
  ///
  /// [discardPendingWork] selects the destructive PD-1 path
  /// ("Discard pending work and sign out"); the default preserves the outgoing
  /// scope's operations so the same cashier resumes them after signing back in.
  ///
  /// Ordering matters, and was deliberately inverted from the pre-Phase-3
  /// sequence, which cleared TOKENS while the identity was still resolved — a
  /// window in which a burst could start a dispatch with no credentials. The
  /// safe order is:
  ///
  ///   1. capture the outgoing identity (only knowable here);
  ///   2. invalidate the AuthState, so `currentUserProvider` becomes null. The
  ///      sync scope guard then fails closed, and every enqueue path that
  ///      builds an outbox operation reads `currentUserProvider` first and
  ///      refuses to build one without an authenticated identity (for example
  ///      `OfflineSaleQueue.enqueueCreateSale` throws a StateError). Nothing
  ///      new can therefore be enqueued or dispatched while cleanup runs.
  ///      NOTE: `OutboxController.enqueue` itself does NOT consult auth state —
  ///      this invariant is enforced by the callers, not by the controller;
  ///   3. clear tokens;
  ///   4. clean the queue for the captured scope (preserve same-scope + drop
  ///      foreign, or drop everything when discarding).
  ///
  /// `cleanupForLogout` additionally bumps the outbox auth epoch, aborting any
  /// burst already in flight.
  Future<LogoutResult> logout({bool discardPendingWork = false}) async {
    // 1. Capture the outgoing identity BEFORE the state is invalidated.
    final outgoing =
        state is AuthAuthenticated ? (state as AuthAuthenticated).user : null;

    // Remote sign-out stays fire-and-forget, as before.
    final storage = _ref.read(tokenStorageProvider);
    final refreshTokenValue = await storage.getRefreshToken();
    unawaited(
      _ref.read(authRepositoryProvider).logout(
            refreshTokenValue: refreshTokenValue,
          ),
    );

    final outbox = _ref.read(outboxControllerProvider.notifier);

    // 2. Invalidate identity first, and bump the epoch so an in-flight burst
    //    re-validates before dispatching anything else.
    state = const AuthUnauthenticated();
    outbox.bumpAuthEpoch();

    // 3. Credentials.
    await storage.clearTokens();

    if (outgoing == null) {
      // Nothing was authenticated: there is no outgoing scope to preserve and
      // no identity to reason about. Keep the legacy full wipe so a stale queue
      // from an earlier session cannot survive an anonymous sign-out.
      try {
        return LogoutResult(queuePersisted: await outbox.clearForLogout());
      } catch (e) {
        _logger.error('Outbox cleanup failed during logout', e);
        return const LogoutResult(queuePersisted: false);
      }
    }

    // 4. PD-1 / PD-2 selective cleanup for the captured outgoing scope.
    try {
      final persisted = await outbox.cleanupForLogout(
        outgoing.companyId,
        outgoing.id,
        discardSameScope: discardPendingWork,
      );
      // false == the store rejected the write without throwing. Report it
      // honestly instead of claiming the cleanup succeeded (P2-2 remediation).
      return LogoutResult(queuePersisted: persisted);
    } catch (e) {
      // Honest failure: do NOT claim the cleanup succeeded. The in-memory queue
      // has already been reduced, but persistence did not confirm, so the
      // caller must surface this to the user.
      _logger.error('Outbox cleanup failed during logout', e);
      return const LogoutResult(queuePersisted: false);
    }
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final authStateProvider =
    StateNotifierProvider<AuthStateNotifier, AuthState>((ref) {
  return AuthStateNotifier(ref);
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  final state = ref.watch(authStateProvider);
  return state is AuthAuthenticated;
});

final currentUserProvider = Provider<CurrentUser?>((ref) {
  final state = ref.watch(authStateProvider);
  return state is AuthAuthenticated ? (state as AuthAuthenticated).user : null;
});

final currentUserRolesProvider = Provider<List<String>>((ref) {
  final user = ref.watch(currentUserProvider);
  return user?.roles ?? [];
});

final currentUserPermissionsProvider = Provider<List<String>>((ref) {
  final user = ref.watch(currentUserProvider);
  return user?.permissions ?? [];
});

final isOfflineProvider = StateProvider<bool>((ref) => false);

/// Outcome of a sign-out, so the caller can report honestly whether the queue
/// cleanup actually persisted.
class LogoutResult {
  const LogoutResult({required this.queuePersisted});

  /// False when the cleanup could not be written to storage. The in-memory
  /// queue has already been reduced, but the caller MUST NOT claim the discard
  /// succeeded.
  final bool queuePersisted;
}
