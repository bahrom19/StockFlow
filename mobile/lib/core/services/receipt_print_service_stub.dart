import 'dart:typed_data';

/// Non-web fallback: receipt output is a web-terminal concern.
///
/// Windows native printing (system print dialog via a platform channel) is
/// the recorded next phase — this stub deliberately fails fast instead of
/// faking success. Callers (POS workspace / POS screen) catch the error and
/// show a localized snackbar, so no crash reaches the user.
Future<void> downloadPdf(Uint8List bytes, String filename) async {
  // async so the error is delivered through the returned Future (the
  // signature contract) instead of throwing synchronously at the call site.
  throw UnsupportedError(
    'PDF download is only supported on the web build of StockFlow POS.',
  );
}

Future<void> printHtml(String html) async {
  // async so the error is delivered through the returned Future (the
  // signature contract) instead of throwing synchronously at the call site.
  throw UnsupportedError(
    'Receipt printing is only supported on the web build of StockFlow POS.',
  );
}
