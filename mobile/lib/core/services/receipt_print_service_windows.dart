// Windows-native receipt printing for StockFlow POS.
//
// Isolation guarantees:
// - This file is imported ONLY by receipt_print_service_stub.dart (the native
//   branch of the ReceiptPrintService conditional import). It is never part
//   of the web compilation graph, so neither this code nor `package:printing`
//   can leak into the browser build.
// - Printing goes through the maintained `printing` plugin: the 80mm roll PDF
//   produced by ReceiptExport.buildPdf is rendered by the plugin (bundled
//   pdfium) and submitted through the standard Windows print dialog, which
//   natively provides printer selection — including 80mm thermal printers
//   installed in Windows.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:printing/printing.dart';

/// A receipt-printing failure that is safe to show to the user.
///
/// [code] is a stable machine-readable identifier (for localization mapping /
/// diagnostics); [message] is the human-readable text the POS layer surfaces
/// via the existing localized "Print failed" snackbar. Raw Windows/platform
/// exceptions are never exposed through this type.
class ReceiptPrintException implements Exception {
  final String code;
  final String message;

  const ReceiptPrintException(this.code, this.message);

  @override
  String toString() => message;
}

typedef ReceiptPdfLayoutCallback = FutureOr<Uint8List> Function(
    PdfPageFormat format);
typedef PrintJobLauncher = Future<bool> Function({
  required ReceiptPdfLayoutCallback onLayout,
  required String name,
});
typedef PrinterLister = Future<List<Printer>> Function();

PrintJobLauncher? _launcherOverride;
PrinterLister? _listerOverride;

/// Test seam: replaces the platform print pipeline. Call with no arguments to
/// reset. Never use in production code.
@visibleForTesting
void debugConfigureWindowsPrintPipeline({
  PrintJobLauncher? launcher,
  PrinterLister? lister,
}) {
  _launcherOverride = launcher;
  _listerOverride = lister;
}

Future<bool> _hasAnyInstalledPrinter(PrinterLister lister) async {
  try {
    return (await lister()).isNotEmpty;
  } catch (_) {
    // Enumeration is best-effort. If it fails we still open the system print
    // dialog, which shows whatever printers Windows actually knows about.
    return true;
  }
}

Future<bool> _defaultLaunch({
  required ReceiptPdfLayoutCallback onLayout,
  required String name,
}) {
  return Printing.layoutPdf(
    onLayout: onLayout,
    name: name,
    // Initial paper-size hint for the Windows dialog. The authoritative
    // geometry still comes from the roll80 PDF itself (see below), so no A4
    // scaling is introduced by this parameter.
    format: PdfPageFormat.roll80,
  );
}

/// Prints the already-generated receipt on Windows.
///
/// [html] is intentionally unused here: the browser-only HTML/iframe flow does
/// not exist on Windows. Instead [pdf] produces the SAME receipt content as an
/// 80mm thermal-roll PDF (`PdfPageFormat.roll80`, see
/// `ReceiptExport.buildPdf`), keeping one source of truth for receipt layout,
/// localization and currency formatting. The result prints 1:1 on 80mm paper:
/// no A4 formatting, no extra margins, no application UI, no browser, no
/// intermediate PDF download for the user.
///
/// Failure contract (the POS catches these and shows the localized
/// "Print failed" snackbar):
/// - no installed printer found -> ReceiptPrintException(printerNotFound)
/// - dialog cancelled / no printer selected / driver rejected the job
///                              -> ReceiptPrintException(printJobFailed)
/// - any platform error         -> logged, then wrapped as printJobFailed
///
/// Success is reported ONLY when the plugin confirms the job was handed to
/// the print spooler (`layoutPdf == true`) — never faked.
Future<void> printReceipt({
  required String html,
  required Future<Uint8List> Function() pdf,
}) async {
  final launcher = _launcherOverride ?? _defaultLaunch;
  final lister = _listerOverride ?? Printing.listPrinters;

  if (!await _hasAnyInstalledPrinter(lister)) {
    throw const ReceiptPrintException('printerNotFound', 'Printer not found');
  }

  try {
    final printed =
        await launcher(onLayout: (_) => pdf(), name: 'StockFlow receipt');
    if (!printed) {
      // Covers "user cancelled / no printer selected" and "job refused":
      // nothing reached paper either way, so we must not report success.
      throw const ReceiptPrintException('printJobFailed', 'Print job failed');
    }
  } on ReceiptPrintException {
    rethrow;
  } catch (e, st) {
    // Raw platform exception stays in the log only — users get the safe
    // message through the localized snackbar template.
    debugPrint('StockFlow Windows receipt print failed: $e\n$st');
    throw const ReceiptPrintException('printJobFailed', 'Print job failed');
  }
}