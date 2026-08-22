// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:async';
import 'dart:html' as html;
import 'dart:typed_data';

/// Downloads [bytes] as a file named [filename] via a temporary Blob anchor.
Future<void> downloadPdf(Uint8List bytes, String filename) async {
  final blob = html.Blob([bytes], 'application/pdf');
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)..download = filename;
  html.document.body!.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);
}

/// Renders [markup] inside a hidden same-origin iframe and invokes the
/// browser print dialog scoped to that frame, so only the receipt is printed
/// (not the whole app window).
///
/// Implementation notes — each one fixes a concrete failure of the previous
/// fixed-delay implementation that made the print dialog never open (or open
/// on a blank page) in production:
/// - The frame is sized 1×1 px instead of 0×0: some engines deprioritize or
///   never paint zero-sized frames, which left `contentWindow.print()` a
///   no-op.
/// - Printing waits for the frame's `load` event (with a bounded fallback
///   timeout) instead of an arbitrary delay, so the receipt document is
///   guaranteed to be parsed when the dialog opens.
/// - The frame outlives `print()` by a short grace period because Firefox and
///   Safari dispatch printing asynchronously; removing the frame too early
///   cancelled the pending print job.
Future<void> printHtml(String markup) async {
  final body = html.document.body;
  if (body == null) return;

  final iframe = html.IFrameElement()
    ..style.position = 'fixed'
    ..style.right = '0'
    ..style.bottom = '0'
    ..style.width = '1px'
    ..style.height = '1px'
    ..style.border = '0'
    ..style.opacity = '0'
    ..setAttribute('aria-hidden', 'true')
    ..srcdoc = markup;

  // Subscribe before appending so the load event cannot be missed.
  final loaded = Completer<void>();
  iframe.onLoad.listen((_) {
    if (!loaded.isCompleted) loaded.complete();
  });

  body.append(iframe);

  // Wait until the srcdoc document finished loading. The timeout is only a
  // safety net for engines that never fire `load` on hidden frames.
  await loaded.future.timeout(const Duration(seconds: 5), onTimeout: () {});

  // contentWindow is typed WindowBase; print() lives on Window and opens the
  // browser print dialog scoped to this frame on all modern engines.
  final win = iframe.contentWindow;
  if (win is html.Window) {
    win.print();
  }

  // Give the browser a beat to hand the job to the print pipeline before
  // tearing the frame down.
  await Future<void>.delayed(const Duration(milliseconds: 300));
  iframe.remove();
}

/// Prints a receipt on the web (part of the shared facade contract with the
/// Windows implementation).
///
/// The native/Windows pipeline needs PDF bytes, so the facade also passes a
/// lazy [pdf] builder — but on web we keep the proven hidden-iframe HTML flow
/// unchanged and simply never invoke that builder (no wasted PDF generation,
/// zero behavioral change for the web build).
Future<void> printReceipt({
  required String html,
  required Future<Uint8List> Function() pdf,
}) {
  return printHtml(html);
}
