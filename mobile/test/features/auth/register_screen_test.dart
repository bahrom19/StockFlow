import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/features/auth/presentation/screens/login_screen.dart';
import 'package:stockflow/features/auth/presentation/screens/register_screen.dart';

/// Deterministic in-memory ApiClient double (mirrors auth_repository_test).
class FakeApiClient extends ApiClient {
  FakeApiClient() : super(tokenStorage: TokenStorage());

  final Map<String, Map<String, dynamic>> _responses = {};
  Object? _errorToThrow;
  String? lastPostPath;
  dynamic lastPostData;

  void respond(String path, Map<String, dynamic> data) {
    _responses[path] = data;
  }

  void failWith(Object error) {
    _errorToThrow = error;
  }

  Response<T> _stub<T>(String path) {
    if (_errorToThrow != null) {
      final error = _errorToThrow;
      _errorToThrow = null;
      throw error!;
    }
    final data = _responses[path];
    if (data == null) {
      throw StateError('No stub registered for $path');
    }
    return Response(
      data: data,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    ) as Response<T>;
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    lastPostPath = path;
    lastPostData = data;
    return _stub<T>(path);
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _stub<T>(path);
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('PUT is not stubbed in FakeApiClient ($path)');
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('PATCH is not stubbed in FakeApiClient ($path)');
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('DELETE is not stubbed in FakeApiClient ($path)');
  }
}

/// Minimal router wiring so the register screen can navigate to /login.
GoRouter _buildRouter() {
  return GoRouter(
    initialLocation: RouteNames.register,
    routes: [
      GoRoute(
        path: RouteNames.login,
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: RouteNames.register,
        name: 'register',
        builder: (context, state) => const RegisterScreen(),
      ),
    ],
  );
}

void main() {
  late FakeApiClient fakeApi;
  late ProviderContainer container;

  setUp(() {
    fakeApi = FakeApiClient();
    container = ProviderContainer(overrides: [
      apiClientProvider.overrideWith((ref) => fakeApi),
    ]);
  });

  tearDown(() {
    container.dispose();
  });

  Widget buildApp() {
    return UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: _buildRouter(),
        theme: ThemeData(brightness: Brightness.light),
      ),
    );
  }

  const registerResponse = {
    'accessToken': 'access_token',
    'refreshToken': 'refresh_token',
    'user': {
      'id': 'user-1',
      'email': 'new@stockflow.com',
      'firstName': 'Jane',
      'lastName': 'Doe',
      'companyId': 'company-1',
      'roles': ['Admin'],
    },
  };

  Future<void> fillForm(
    WidgetTester tester, {
    String company = 'TestCorp',
    String fullName = 'Jane Doe',
    String email = 'new@stockflow.com',
    String password = 'StrongPass123',
    String confirm = 'StrongPass123',
  }) async {
    await tester.enterText(
        find.byType(TextFormField).at(0), company);
    await tester.enterText(
        find.byType(TextFormField).at(1), fullName);
    await tester.enterText(
        find.byType(TextFormField).at(2), email);
    await tester.enterText(
        find.byType(TextFormField).at(3), password);
    await tester.enterText(
        find.byType(TextFormField).at(4), confirm);
  }

  /// The register form is taller than the 600px test viewport — scroll the
  /// submit button into view before tapping so the hit test actually lands.
  Future<void> tapCreateAccount(WidgetTester tester) async {
    final button = find.widgetWithText(FilledButton, 'Create Account');
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pump();
  }

  group('RegisterScreen', () {
    testWidgets('renders all registration fields', (tester) async {
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      expect(find.text('Create your account'), findsOneWidget);
      expect(find.text('Company Name'), findsOneWidget);
      expect(find.text('Full Name'), findsOneWidget);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Confirm Password'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Create Account'),
          findsOneWidget);
      expect(find.text('Already have an account?'), findsOneWidget);
    });

    testWidgets('shows validation errors when submitting empty form',
        (tester) async {
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      await tapCreateAccount(tester);

      expect(find.text('This field is required'), findsNWidgets(2));
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
      expect(find.text('Confirm password is required'), findsOneWidget);
    });

    testWidgets('rejects weak password', (tester) async {
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      await fillForm(tester, password: 'weak', confirm: 'weak');
      await tapCreateAccount(tester);

      expect(
        find.text('Password must be at least 8 characters'),
        findsOneWidget,
      );
    });

    testWidgets('rejects password mismatch', (tester) async {
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      await fillForm(tester, confirm: 'Different123');
      await tapCreateAccount(tester);

      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    testWidgets('submits correct payload on successful registration',
        (tester) async {
      fakeApi.respond(ApiEndpoints.register, registerResponse);
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      await fillForm(tester);
      await tapCreateAccount(tester);
      await tester.pumpAndSettle();

      expect(fakeApi.lastPostPath, ApiEndpoints.register);
      final data = fakeApi.lastPostData as Map<String, dynamic>;
      expect(data['companyName'], 'TestCorp');
      expect(data['firstName'], 'Jane');
      expect(data['lastName'], 'Doe');
      expect(data['email'], 'new@stockflow.com');
      expect(data['password'], 'StrongPass123');

      // Success snackbar shown and redirected to login (login-only
      // marker: the 'New to StockFlow?' row is unique to LoginScreen).
      expect(find.text('Account created. Please sign in.'), findsOneWidget);
      expect(find.text('New to StockFlow?'), findsOneWidget);
    });

    testWidgets('shows error snackbar on registration failure',
        (tester) async {
      fakeApi.failWith(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.register),
        response: Response(
          data: {'message': 'Email already registered'},
          statusCode: 409,
          requestOptions: RequestOptions(path: ApiEndpoints.register),
        ),
        type: DioExceptionType.badResponse,
      ));
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      await fillForm(tester);
      await tapCreateAccount(tester);
      await tester.pumpAndSettle();

      expect(find.textContaining('Email already registered'), findsOneWidget);
      // Stays on the register screen.
      expect(find.text('Create your account'), findsOneWidget);
    });

    testWidgets('Sign In link navigates back to login', (tester) async {
      await tester.pumpWidget(buildApp());
      await tester.pumpAndSettle();

      final signIn = find.widgetWithText(TextButton, 'Sign In');
      await tester.ensureVisible(signIn);
      await tester.pumpAndSettle();
      await tester.tap(signIn);
      await tester.pumpAndSettle();

      expect(find.text('Sign In'), findsWidgets);
      expect(find.text('Create your account'), findsNothing);
    });
  });
}
