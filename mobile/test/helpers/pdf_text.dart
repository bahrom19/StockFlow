import 'dart:io';
import 'dart:typed_data';

/// Extracts text from dart_pdf-generated PDFs (embedded TTF subsets).
///
/// dart_pdf embeds each TTF (regular/bold) as a *subset* and writes text as
/// per-glyph IDs inside `[<....>]TJ` operators. Every subset ships its own
/// ToUnicode CMap (Adobe-Identity-UCS), and **glyph IDs collide across
/// subsets** — so decoding MUST be per-font: the content stream's `/F5 10 Tf`
/// selects the active font, and only that font's CMap may decode the run.
///
/// The helper:
///   1. parses every `N 0 obj` object;   2. links page font resources
///   (`/F5 5 0 R`) to their ToUnicode CMap streams;   3. builds a per-font
///   glyph→codePoint map (bfchar + bfrange);   4. walks content streams,
///   tracks `/FN Tf`, decodes each `[<hex>]TJ` run with the active font's
///   map, and joins per-`TJ` tokens with a space.
String extractPdfText(Uint8List bytes) {
  final raw = String.fromCharCodes(bytes);

  // 1. Objects: number -> raw content.
  final objs = <int, String>{};
  for (final m in RegExp(r'(\d+) 0 obj(.*?)endobj', dotAll: true)
      .allMatches(raw)) {
    objs[int.parse(m.group(1)!)] = m.group(2)!;
  }

  // 2. Decompress every FlateDecode stream.
  List<int> inflate(String body) {
    try {
      return ZLibCodec().decode(body.codeUnits);
    } catch (_) {
      return body.codeUnits;
    }
  }

  final streamRe = RegExp(r'stream\r?\n(.*?)endstream', dotAll: true);

  // 3. Find fonts: objNumber -> {name, cmapStream}
  final fontByName = <String, Map<int, int>>{};
  final pageRe = RegExp(r'/Font\s*<<(.*?)>>', dotAll: true);
  final fontLinkRe = RegExp(r'/(F\d+)\s+(\d+)\s+0\s+R');
  for (final page in pageRe.allMatches(raw)) {
    for (final fl in fontLinkRe.allMatches(page.group(1)!)) {
      final name = fl.group(1)!;
      final num = int.parse(fl.group(2)!);
      final obj = objs[num] ?? '';
      final toUnicode = RegExp(r'/ToUnicode\s+(\d+)\s+0\s+R').firstMatch(obj);
      if (toUnicode == null) continue;
      final cmapObj = objs[int.parse(toUnicode.group(1)!)] ?? '';
      final cmapRaw = streamRe.firstMatch(cmapObj)?.group(1) ?? '';
      final cmapText = String.fromCharCodes(inflate(cmapRaw));
      final map = <int, int>{};
      final bfchar = RegExp(r'beginbfchar(.*?)endbfchar', dotAll: true)
          .firstMatch(cmapText)
          ?.group(1);
      if (bfchar != null) {
        for (final m in RegExp(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>')
            .allMatches(bfchar)) {
          map[int.parse(m.group(1)!, radix: 16)] =
              int.parse(m.group(2)!, radix: 16);
        }
      }
      final bfrange = RegExp(r'beginbfrange(.*?)endbfrange', dotAll: true)
          .firstMatch(cmapText)
          ?.group(1);
      if (bfrange != null) {
        for (final m in RegExp(
                r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>')
            .allMatches(bfrange)) {
          final lo = int.parse(m.group(1)!, radix: 16);
          final hi = int.parse(m.group(2)!, radix: 16);
          final dst = int.parse(m.group(3)!, radix: 16);
          for (var i = lo; i <= hi && i - lo < 4096; i++) {
            map[i] = dst + (i - lo);
          }
        }
      }
      fontByName[name] = map;
    }
  }

  // 4. Content streams: track /FN Tf and decode TJ runs per font.
  final out = StringBuffer();
  for (final obj in objs.values) {
    final stream = streamRe.firstMatch(obj)?.group(1);
    if (stream == null) continue;
    final text = String.fromCharCodes(inflate(stream));
    if (!text.contains('BT')) continue;
    var active = 'F5';
    final tokens = <String>[];
    // Walk sequentially: font switches and TJ runs interleave.
    final combined = RegExp(r'/(F\d+)\s+[\d.]+\s+Tf|\[<([0-9A-Fa-f]+)>\]TJ');
    for (final m in combined.allMatches(text)) {
      if (m.group(1) != null) {
        active = m.group(1)!;
      } else {
        final body = m.group(2)!;
        final map = fontByName[active] ?? const <int, int>{};
        final buf = StringBuffer();
        for (var i = 0; i + 4 <= body.length; i += 4) {
          final gid = int.parse(body.substring(i, i + 4), radix: 16);
          buf.writeCharCode(map[gid] ?? 0xFFFD);
        }
        if (buf.isNotEmpty) tokens.add(buf.toString());
      }
    }
    if (tokens.isNotEmpty) {
      if (out.isNotEmpty) out.write(' ');
      out.write(tokens.join(' '));
    }
  }
  return out.toString();
}
