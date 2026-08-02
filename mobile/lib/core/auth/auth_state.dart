import 'dart:async' show unawaited;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/logger/app_logger.dart';
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
      } else {
        await storage.clearTokens();
        state = const AuthUnauthenticated();
      }
    } catch (_) {
      await storage.clearTokens();
      state = const AuthUnauthenticated();
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AuthLoading();
    try {
      final repo = _ref.read(authRepositoryProvider);
      final result = await repo.login(email: email, password: password);

      if (result is ApiSuccess<LoginResponse>) {
        state = AuthAuthenticated(result.data.user);
      } else {
        final message = result is ApiFailure<LoginResponse>
            ? result.error.message
            : 'Login failed';
        state = AuthError(message);
      }
    } catch (e) {
      _logger.error('Login failed', e);
      state = AuthError('Login failed. Please check your credentials.');
    }
  }

  Future<void> logout() async {
    final storage = _ref.read(tokenStorageProvider);
    final refreshTokenValue = await storage.getRefreshToken();
    unawaited(
      _ref.read(authRepositoryProvider).logout(
            refreshTokenValue: refreshTokenValue,
          ),
    );
    await storage.clearTokens();
    state = const AuthUnauthenticated();
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
