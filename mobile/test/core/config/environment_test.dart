import 'dart:io';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/config/environment.dart';

const String _productionBaseUrl =
    'https://stockflow-production-04c7.up.railway.app/api';

/// A pristine [DotEnv] per test. `DotEnv.clean()` empties the map but leaves
/// the instance flagged as initialized, so replacing the instance is what
/// actually guarantees that a test starts uninitialized. [tearDown] cleans and
/// restores the global so no configuration leaks between tests or files.
void main() {
  final originalDotEnv = dotenv;

  setUp(() {
    dotenv = DotEnv();
    Environment.debugResetForTesting();
  });

  tearDown(() {
    dotenv.clean();
    dotenv = originalDotEnv;
    Environment.debugResetForTesting();
  });

  group('URL validation', () {
    test('accepts an http loopback target', () {
      final uri = Environment.validateApiBaseUrl(
        'http://localhost:3000/api',
        allowProduction: false,
      );
      expect(uri.host, 'localhost');
      expect(uri.port, 3000);
      expect(uri.scheme, 'http');
    });

    test('accepts an https loopback target', () {
      expect(
        Environment.validateApiBaseUrl('https://127.0.0.1/api',
                allowProduction: false)
            .host,
        '127.0.0.1',
      );
    });

    test('accepts a production target only when production is allowed', () {
      expect(
        Environment.validateApiBaseUrl(_productionBaseUrl,
            allowProduction: true).host,
        'stockflow-production-04c7.up.railway.app',
      );
    });

    test('rejects any Railway host when production is not allowed', () {
      for (final host in <String>[
        'stockflow-production-04c7.up.railway.app',
        'stockflow-staging-1234.up.railway.app',
        'anything.up.railway.app',
        'up.railway.app',
      ]) {
        expect(
          () => Environment.validateApiBaseUrl('https://$host/api',
              allowProduction: false),
          throwsA(isA<EnvironmentConfigError>()),
          reason: '$host must be rejected outside ENV=prod',
        );
      }
    });

    test('rejects the production host with a DNS root-label suffix', () {
      // `host.` and `host..` are DNS-equivalent to `host`, so a raw
      // endsWith comparison would let them through and still reach production.
      for (final raw in <String>[
        'https://stockflow-production-04c7.up.railway.app/api',
        'https://stockflow-production-04c7.up.railway.app./api',
        'https://stockflow-production-04c7.up.railway.app../api',
        'https://stockflow-production-04c7.up.railway.app.../api',
        'https://STOCKFLOW-PRODUCTION-04C7.UP.RAILWAY.APP./api',
        'https://subdomain.up.railway.app./api',
        'https://up.railway.app./api',
      ]) {
        expect(
          () => Environment.validateApiBaseUrl(raw, allowProduction: false),
          throwsA(isA<EnvironmentConfigError>()),
          reason: '$raw must be rejected outside ENV=prod',
        );
      }
    });

    test('a similar suffix on a different domain is not production', () {
      // These end in "railway.app" but are not under Railway's up.railway.app,
      // so normalising them must not misclassify them as production.
      for (final raw in <String>[
        'https://railway.app.evil.example/api',
        'https://stockflow-production-04c7.up.railway.app.evil.example/api',
        'https://evil-up.railway.app/api',
        'https://up.railway.app.evil.example/api',
        'https://localhost./api',
      ]) {
        expect(
          Environment.validateApiBaseUrl(raw, allowProduction: false).host,
          isNotEmpty,
          reason: '$raw must stay reachable outside ENV=prod',
        );
      }
    });

    test('rejects empty and non-absolute values', () {
      for (final raw in <String>['', 'localhost:3000', '/api', '://x']) {
        expect(
          () => Environment.validateApiBaseUrl(raw, allowProduction: false),
          throwsA(isA<EnvironmentConfigError>()),
          reason: '"$raw" must be rejected',
        );
      }
    });

    test('rejects schemes other than http and https', () {
      for (final raw in <String>[
        'ftp://localhost/x',
        'file:///etc/passwd',
        'ws://localhost:3000/api',
      ]) {
        expect(
          () => Environment.validateApiBaseUrl(raw, allowProduction: false),
          throwsA(isA<EnvironmentConfigError>()),
          reason: '"$raw" must be rejected',
        );
      }
    });

    test('rejects embedded credentials', () {
      expect(
        () => Environment.validateApiBaseUrl('https://user:pass@localhost/api',
            allowProduction: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
      expect(
        () => Environment.validateApiBaseUrl(
            'https://localhost@remote.example/api',
            allowProduction: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('rejects a missing host', () {
      expect(
        () => Environment.validateApiBaseUrl('http:///api',
            allowProduction: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('rejects an empty port', () {
      expect(
        () => Environment.validateApiBaseUrl('http://localhost:/api',
            allowProduction: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('rejects a non-numeric port', () {
      expect(
        () => Environment.validateApiBaseUrl('http://localhost:invalid/api',
            allowProduction: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('rejects ports outside 1-65535', () {
      // Uri.parse itself accepts 99999 and 65536, so this is the check that
      // actually protects the target.
      for (final raw in <String>[
        'http://localhost:0/api',
        'http://localhost:99999/api',
        'http://localhost:65536/api',
      ]) {
        expect(
          () => Environment.validateApiBaseUrl(raw, allowProduction: false),
          throwsA(isA<EnvironmentConfigError>()),
          reason: '"$raw" must be rejected',
        );
      }
    });

    test('rejects whitespace and control characters', () {
      for (final raw in <String>[
        ' http://localhost:3000/api',
        'http://localhost:3000/api ',
        'http://local host:3000/api',
        'http://localhost\t:3000/api',
        'http://localhost:3000/api\nEVIL=https://remote.example',
      ]) {
        expect(
          () => Environment.validateApiBaseUrl(raw, allowProduction: false),
          throwsA(isA<EnvironmentConfigError>()),
          reason: 'must be rejected: ${raw.replaceAll('\n', '\\n')}',
        );
      }
    });

    test('rejects an IPv6 literal host', () {
      expect(
        () => Environment.validateApiBaseUrl('http://[::1]:3000/api',
            allowProduction: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
    });
  });

  group('apiBaseUrl resolution', () {
    test('never yields a production host when dotenv is uninitialized', () {
      expect(dotenv.isInitialized, isFalse);
      final resolved = Environment.apiBaseUrl;
      expect(resolved, isNot(contains('up.railway.app')));
      expect(resolved.startsWith('http://localhost'), isTrue);
    });

    test('never yields a production host when the key is absent', () {
      dotenv.testLoad(fileInput: 'APP_ENV=dev\nAPI_TIMEOUT=30000');
      expect(dotenv.env.containsKey('API_BASE_URL'), isFalse);
      final resolved = Environment.apiBaseUrl;
      expect(resolved, isNot(contains('up.railway.app')));
    });

    test('returns the configured loopback target verbatim', () {
      dotenv.testLoad(fileInput: 'API_BASE_URL=http://localhost:3000/api');
      expect(Environment.apiBaseUrl, 'http://localhost:3000/api');
    });

    test('rejects a production target configured for a non-prod environment',
        () {
      dotenv.testLoad(fileInput: 'API_BASE_URL=$_productionBaseUrl');
      Environment.debugOverrideForTesting(environment: 'dev');
      expect(
        () => Environment.apiBaseUrl,
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('refuses ENV=prod in a debug build regardless of the URL', () {
      dotenv.testLoad(fileInput: 'API_BASE_URL=$_productionBaseUrl');
      Environment.debugOverrideForTesting(environment: 'prod');
      expect(
        () => Environment.apiBaseUrl,
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('refuses ENV=prod in a debug build even for a loopback URL', () {
      // The gate is on the build mode, not on the value: selecting `prod` on a
      // non-release build is refused regardless of what the file contains.
      dotenv.testLoad(fileInput: 'API_BASE_URL=http://localhost:3000/api');
      Environment.debugOverrideForTesting(environment: 'prod');
      expect(
        () => Environment.apiBaseUrl,
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('a debug override is validated like any configured value', () {
      Environment.debugOverrideForTesting(apiBaseUrl: _productionBaseUrl);
      expect(
        () => Environment.apiBaseUrl,
        throwsA(isA<EnvironmentConfigError>()),
      );
    });
  });

  group('environment selection', () {
    test('maps every known environment to a bundled asset', () {
      for (final env in <String>['dev', 'test', 'e2e', 'prod']) {
        Environment.debugOverrideForTesting(environment: env);
        expect(Environment.assetFileName, startsWith('env/.env.'));
      }
    });

    test('rejects an unknown environment instead of guessing an asset', () {
      Environment.debugOverrideForTesting(environment: 'staging');
      expect(
        () => Environment.assetFileName,
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('prod is the only environment that is production', () {
      for (final env in <String>['dev', 'test', 'e2e']) {
        Environment.debugOverrideForTesting(environment: env);
        expect(Environment.isProduction, isFalse, reason: env);
      }
      Environment.debugOverrideForTesting(environment: 'prod');
      expect(Environment.isProduction, isTrue);
    });

    test('a debug build without ENV selects the development environment', () {
      // kReleaseMode is false in the test VM, so an absent define must resolve
      // to dev — the production default is reachable only from a release build.
      expect(Environment.assetFileName, 'env/.env.dev');
      expect(Environment.isProduction, isFalse);
    });

    test('a non-debug build without ENV refuses to start', () {
      // The profile/release branch is unreachable from the debug test VM, so it
      // is exercised through the resolver directly.
      expect(
        () => Environment.resolveEnvironmentName('', isDebugBuild: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
      expect(
        () => Environment.resolveEnvironmentName('   ', isDebugBuild: false),
        throwsA(isA<EnvironmentConfigError>()),
      );
    });

    test('the resolver honours an explicit define in any build mode', () {
      expect(
        Environment.resolveEnvironmentName('prod', isDebugBuild: false),
        'prod',
      );
      expect(
        Environment.resolveEnvironmentName('PROD', isDebugBuild: false),
        'prod',
      );
      expect(
        Environment.resolveEnvironmentName('e2e', isDebugBuild: false),
        'e2e',
      );
      expect(
        Environment.resolveEnvironmentName('', isDebugBuild: true),
        'dev',
      );
    });

    test('selecting prod marks the environment but never authorises it', () {
      Environment.debugOverrideForTesting(environment: 'prod');
      expect(Environment.isProduction, isTrue);
      expect(
        () => Environment.apiBaseUrl,
        throwsA(isA<EnvironmentConfigError>()),
        reason: 'identity is not authorisation in a debug build',
      );
    });
  });

  group('committed configuration files', () {
    File readRepoFile(String path) {
      final file = File(path);
      expect(
        file.existsSync(),
        isTrue,
        reason: '$path not found — tests must run from the mobile/ package root',
      );
      return file;
    }

    test('dev configuration does not target production', () {
      final content = readRepoFile('env/.env.dev').readAsStringSync();
      expect(content, isNot(contains('up.railway.app')));
      expect(
        content,
        contains('API_BASE_URL=http://localhost:3000/api'),
      );
    });

    test('e2e configuration does not target production', () {
      final content = readRepoFile('env/.env.e2e').readAsStringSync();
      expect(content, isNot(contains('up.railway.app')));
      expect(content, contains('API_BASE_URL=http://localhost:3000/api'));
    });

    test('prod configuration still targets production', () {
      final content = readRepoFile('env/.env.prod').readAsStringSync();
      expect(content, contains('API_BASE_URL=$_productionBaseUrl'));
    });

    test('the implicit production fallback is gone from the source', () {
      final source =
          readRepoFile('lib/core/config/environment.dart').readAsStringSync();
      expect(
        source,
        isNot(contains('_defaultBaseUrl')),
        reason: 'an implicit production fallback was reintroduced',
      );
      expect(
        source,
        isNot(contains("?? 'http")),
        reason: 'apiBaseUrl must not fall back to any hardcoded URL',
      );
    });
  });
}
