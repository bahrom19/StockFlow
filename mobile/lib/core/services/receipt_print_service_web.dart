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

/// Renders [markup] inside a hidden iframe and invokes the browser print dialog
/// scoped to that iframe (so only the receipt is printed, not the app).
Future<void> printHtml(String markup) async {
  final iframe = html.IFrameElement()
    ..style.position = 'fixed'
    ..style.right = '0'
    ..style.bottom = '0'
    ..style.width = '0'
    ..style.height = '0'
    ..style.border = '0'
    ..srcdoc = markup;
  html.document.body!.append(iframe);

  // Wait for the srcdoc iframe to finish loading before printing.
  await Future<void>.delayed(const Duration(milliseconds: 350));
  final win = iframe.contentWindow;
  if (win is html.Window) {
    win.print();
  }
  await Future<void>.delayed(const Duration(milliseconds: 200));
  iframe.remove();
}
