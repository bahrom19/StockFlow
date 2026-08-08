import 'package:flutter/material.dart';

/// Lightweight shimmer placeholder — a sweeping highlight over a base box.
///
/// Single [AnimationController] per widget; automatically disposed. Used for
/// greeting / KPI skeletons so loading feels alive instead of broken.
class ShimmerBox extends StatefulWidget {
  final double width;
  final double height;
  final double radius;
  final EdgeInsets? margin;

  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.radius = 6,
    this.margin,
  });

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        // A highlight band that sweeps left → right.
        final begin = (t * 3) - 1.0;
        final end = begin + 1.0;
        return Container(
          width: widget.width,
          height: widget.height,
          margin: widget.margin,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                base,
                base.withOpacity(0.4),
                base,
              ],
              stops: [
                begin.clamp(0.0, 1.0),
                (begin + 0.5).clamp(0.0, 1.0),
                end.clamp(0.0, 1.0),
              ],
            ),
          ),
        );
      },
    );
  }
}
