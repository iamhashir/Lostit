package expo.modules.portionscanner

// Allows physical-distance validation to compare Double millimeter estimates
// against integer millimeter working ranges without lossy casts.
operator fun IntRange.contains(value: Double): Boolean =
  value >= first.toDouble() && value <= last.toDouble()
