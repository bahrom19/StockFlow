import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';

/// In-memory TokenStorage — never touches platform channels.
class _FakeTokenStorage extends TokenStorage {
  String? accessToken = 'old-access';
  String? refreshToken = 'old-refresh';

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    this.accessToken = accessToken;
    if (refreshToken != null) this.refreshToken = refreshToken;
  }

  @override
  Future<void> clearTokens() async {
    accessToken = null;
    refreshToken = null;
  }
}

/// Scriptable adapter: every call invokes the single script function with the
/// zero-based call index. It either answers a [ResponseBody] or throws
/// (e.g. a DioException simulating a network failure).
class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this._script);

  final Object Function(RequestOptions options, int call) _script;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final call = requests.length;
    requests.add(options);
    final result = _script(options, call);
    if (result is ResponseBody) return result;
    throw result;
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status) => ResponseBody.fromString(
      '{"ok":true}',
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

DioException _networkError(RequestOptions options) =>
    DioException.connectionError(requestOptions: options, reason: 'offline');

ApiClient _buildClient(
  _ScriptedAdapter adapter, {
  _ScriptedAdapter? refresh,
  _FakeTokenStorage? storage,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.test'));
  dio.httpClientAdapter = adapter;
  final refreshDio = Dio(BaseOptions(baseUrl: 'https://api.test'));
  refreshDio.httpClientAdapter =
      refresh ?? _ScriptedAdapter((o, i) => _json(200));
  return ApiClient(
    tokenStorage: storage ?? _FakeTokenStorage(),
    dio: dio,
    refreshDio: refreshDio,
    retryDelay: Duration.zero, // keep tests fast; prod keeps 1s/2s/3s
  );
}

void main() {
  test('GET + network error → retried automatically', () async {
    final adapter = _ScriptedAdapter((o, i) =>
        i >= 2 ? _json(200) : _networkError(o)); // 2 failures, then success
    final client = _buildClient(adapter);
    final res = await client.get<dynamic>('/products');
    expect(res.statusCode, 200);
    expect(adapter.requests.length, 3);
  });

  test('GET + 5xx → retried automatically', () async {
    final adapter =
        _ScriptedAdapter((o, i) => i >= 1 ? _json(200) : _json(500));
    final client = _buildClient(adapter);
    final res = await client.get<dynamic>('/products');
    expect(res.statusCode, 200);
    expect(adapter.requests.length, 2);
  });

  test('POST + network error → exactly ONE request (no auto retry)', () async {
    final adapter = _ScriptedAdapter((o, i) => _networkError(o));
    final client = _buildClient(adapter);
    await expectLater(
      client.post<dynamic>('/sales', data: {}),
      throwsA(isA<DioException>()),
    );
    expect(adapter.requests.length, 1);
  });

  test('POST + 500 → exactly ONE request (no auto retry)', () async {
    final adapter = _ScriptedAdapter((o, i) => _json(500));
    final client = _buildClient(adapter);
    await expectLater(
      client.post<dynamic>('/sales', data: {}),
      throwsA(isA<DioException>().having(
        (e) => e.response?.statusCode, 'status', 500,
      )),
    );
    expect(adapter.requests.length, 1);
  });

  test('PATCH + 500 → exactly ONE request (no auto retry)', () async {
    final adapter = _ScriptedAdapter((o, i) => _json(500));
    final client = _buildClient(adapter);
    await expectLater(
      client.patch<dynamic>('/customers/1', data: {}),
      throwsA(isA<DioException>()),
    );
    expect(adapter.requests.length, 1);
  });

  test('DELETE + 500 → exactly ONE request (no auto retry)', () async {
    final adapter = _ScriptedAdapter((o, i) => _json(500));
    final client = _buildClient(adapter);
    await expectLater(
      client.delete<dynamic>('/customers/1'),
      throwsA(isA<DioException>()),
    );
    expect(adapter.requests.length, 1);
  });

  test('PUT + network error → exactly ONE request (no auto retry)', () async {
    final adapter = _ScriptedAdapter((o, i) => _networkError(o));
    final client = _buildClient(adapter);
    await expectLater(
      client.put<dynamic>('/products/1', data: {}),
      throwsA(isA<DioException>()),
    );
    expect(adapter.requests.length, 1);
  });

  test('401 → refresh token once → original GET retried with new token',
      () async {
    final adapter =
        _ScriptedAdapter((o, i) => i == 0 ? _json(401) : _json(200));
    final refreshAdapter = _ScriptedAdapter(
      (o, i) => ResponseBody.fromString(
        '{"accessToken":"new-access","refreshToken":"new-refresh"}',
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      ),
    );
    final storage = _FakeTokenStorage();
    final client =
        _buildClient(adapter, refresh: refreshAdapter, storage: storage);
    final res = await client.get<dynamic>('/customers');
    expect(res.statusCode, 200);
    // Original + auth retry only — the retry interceptor must NOT add calls.
    expect(adapter.requests.length, 2);
    expect(refreshAdapter.requests.length, 1);
    expect(storage.accessToken, 'new-access');
    expect(adapter.requests[1].headers['Authorization'], 'Bearer new-access');
  });
}