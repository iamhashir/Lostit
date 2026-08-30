from pathlib import Path
import re


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing marker: {label}")
    return text.replace(old, new, 1)


def require_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Regex patch failed: {label} ({count})")
    return updated

# ---------------- App navigation / workflow ----------------
app_path = Path('App.tsx')
app = app_path.read_text()

app = require_replace(
    app,
    '<TodayScreen meals={meals} onHistory={() => navigation.navigate(\'History\')} />',
    '<TodayScreen meals={meals} onHistory={() => navigation.navigate(\'Foods\')} />',
    'home history target'
)
app = require_replace(
    app,
    '{() => <FoodsScreen foods={allFoods} onAddCustom={addCustomFood} />}',
    '{() => <MealsScreen meals={meals} onDelete={deleteMeal} />}',
    'foods route replacement'
)
app = require_replace(app, 'label="Today"', 'label="Home"', 'home tab label')
app = require_replace(app, 'label="Foods"', 'label="Meals"', 'meals tab label')
app = require_replace(app, 'accessibilityLabel="Add meal"', 'accessibilityLabel="Add or scan"', 'add scan a11y')
app = require_replace(
    app,
    '<Text style={[styles.addTabLabel, active && styles.addTabLabelActive]}>Add meal</Text>',
    '<Text style={[styles.addTabLabel, active && styles.addTabLabelActive]}>Add/Scan</Text>',
    'add scan tab label'
)
app = require_replace(app, 'title="Today"', 'title="Home"', 'home screen title')

old_header = '''          <ScreenHeader
            eyebrow="Log meal"
            title="What did you eat?"
            subtitle="Select foods and enter the amount. Everything is calculated locally."
          />

          <Text style={styles.fieldLabel}>Meal name</Text>'''
new_header = '''          <ScreenHeader
            eyebrow="Meal workflow"
            title="Add / Scan"
            subtitle="Search for the food, then scan the portion or enter grams manually."
          />

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>SCAN</Text>
              <Text style={styles.sectionTitle}>Live portion scanner</Text>
            </View>
          </View>
          <PortionScannerEntry
            foodName={selectedFood?.name ?? 'Food portion'}
            onEstimateGrams={(value) => setGrams(String(Math.max(1, Math.round(value))))}
          />

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>SEARCH & ADD</Text>
              <Text style={styles.sectionTitle}>Build the meal</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Meal name</Text>'''
app = require_replace(app, old_header, new_header, 'add scan header')
app = require_replace(app, '<Text style={styles.fieldLabel}>Find food</Text>', '<Text style={styles.fieldLabel}>Search food</Text>', 'search label')
app = require_replace(app, '\n              <PortionScannerEntry foodName={selectedFood.name} />\n', '\n', 'remove duplicate selected scanner')

meals_screen = r'''function MealsScreen({ meals, onDelete }: { meals: Meal[]; onDelete: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const sorted = [...meals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = sorted.filter((meal) => new Date(meal.createdAt).getTime() >= cutoff);
  const loggedDays = Math.max(1, new Set(recent.map((meal) => localDateKey(meal.createdAt))).size);
  const recentTotal = totalForMeals(recent);
  const forecast: Nutrition = {
    calories: recentTotal.calories / loggedDays,
    protein: recentTotal.protein / loggedDays,
    carbs: recentTotal.carbs / loggedDays,
    fat: recentTotal.fat / loggedDays,
    fiber: recentTotal.fiber / loggedDays,
    sugar: recentTotal.sugar / loggedDays,
    sodium: recentTotal.sodium / loggedDays
  };

  const confirmDelete = (meal: Meal) => {
    Alert.alert('Delete meal?', `${meal.name} will be removed from your meal log.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(meal.id) }
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 118 + insets.bottom }
        ]}
      >
        <ScreenHeader
          eyebrow="Meal log"
          title="Meals"
          subtitle={`${sorted.length} saved meal${sorted.length === 1 ? '' : 's'} · history and recent trend`}
        />

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Next-day forecast</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroNumber}>{Math.round(forecast.calories)}</Text>
            <Text style={styles.heroUnit}>kcal</Text>
          </View>
          <Text style={styles.heroCaption}>
            {recent.length === 0
              ? 'Log meals to build a recent-day forecast.'
              : `Based on ${loggedDays} logged day${loggedDays === 1 ? '' : 's'} from the last 7 days.`}
          </Text>
          <View style={styles.heroDivider} />
          <MacroGrid nutrition={forecast} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>HISTORY</Text>
            <Text style={styles.sectionTitle}>All meals</Text>
          </View>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Clock3 size={18} color={theme.green} strokeWidth={2.2} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No meals yet</Text>
              <Text style={styles.muted}>Meals saved from Add/Scan will appear here.</Text>
            </View>
          </View>
        ) : (
          sorted.map((meal) => (
            <View key={meal.id} style={styles.historyBlock}>
              <MealCard meal={meal} showDate />
              <Pressable
                style={styles.deleteInline}
                onPress={() => confirmDelete(meal)}
                hitSlop={8}
              >
                <Trash2 size={14} color={theme.danger} strokeWidth={2} />
                <Text style={styles.deleteInlineText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenHeader('''
app = require_regex(
    app,
    r'function FoodsScreen\([\s\S]*?\nfunction ScreenHeader\(',
    meals_screen,
    'replace foods screen with meals screen'
)
app_path.write_text(app)

# ---------------- Scanner basic/raw mode ----------------
scanner_path = Path('src/PortionScannerEntry.tsx')
scanner = scanner_path.read_text()
scanner = scanner.replace('Camera, Check, Crosshair', 'Camera, Crosshair', 1)
scanner = require_replace(
    scanner,
    '  const assessment = useMemo(() => assessScan(reading), [reading]);\n  const liveGrams = reading && assessment.geometryValid ? estimateGrams(reading, density) : 0;',
    '  const liveGrams = reading ? estimateGrams(reading, density) : 0;',
    'raw live grams'
)
scanner = require_replace(
    scanner,
    '  const canCapture = Boolean(reading && assessment.ready);',
    '  const canCapture = Boolean(reading && reading.rawVolumeMl > 0);',
    'basic capture gate'
)
scanner = require_replace(
    scanner,
    '  const showMeasurement = Boolean(reading && assessment.geometryValid && reading.sampleWindow >= 3);\n  const quality = estimateQuality(reading, assessment);',
    '  const showMeasurement = Boolean(reading && reading.rawVolumeMl > 0);',
    'show raw immediately'
)
scanner = require_replace(scanner, '<Text style={styles.title}>Depth measurement</Text>', '<Text style={styles.title}>Live scanner</Text>', 'scanner title')
scanner = require_replace(scanner, '<Text style={styles.betaText}>ROUND 2</Text>', '<Text style={styles.betaText}>BASIC</Text>', 'scanner badge')
scanner = require_regex(
    scanner,
    r'<Text style=\{styles\.description\}>\s*The scanner now rejects bad distance, uneven bases and unstable frames before showing a usable result\.\s*</Text>',
    '<Text style={styles.description}>\n              Basic mode shows raw depth measurements immediately. No framing, stability or confidence gate blocks capture.\n            </Text>',
    'scanner basic description'
)
scanner = require_regex(
    scanner,
    r'''              <View style=\{styles\.guidanceHeader\}>.*?</View>\n\n              <View style=\{styles\.gatesRow\}>.*?</View>\n\n              <View style=\{styles\.metricGrid\}>''',
    '''              <View style={styles.guidanceHeader}>
                <Text style={styles.guidanceHeadline}>
                  {reading?.rawVolumeMl > 0 ? 'Depth detected' : 'Find one item'}
                </Text>
                <Text style={styles.guidanceText}>
                  Raw mode is active. Keep the item inside the adjustable frame and capture whenever a volume appears.
                </Text>
              </View>

              <View style={styles.metricGrid}>''',
    'remove scanner gates'
)
scanner = scanner.replace('`${Math.round(reading.estimatedVolumeMl)} ml`', '`${Math.round(reading.rawVolumeMl)} ml`')
scanner = require_regex(
    scanner,
    r'''                <ScannerMetric\n                  label="STABILITY"\n                  value=\{stabilityLabel\(reading\)\}\n                />\n                <ScannerMetric\n                  label="QUALITY"\n                  value=\{quality\.label\}\n                  valueColor=\{quality\.color\}\n                  alignRight\n                />''',
    '''                <ScannerMetric
                  label="DISTANCE"
                  value={reading?.distanceCm ? `${Math.round(reading.distanceCm)} cm` : '—'}
                />
                <ScannerMetric
                  label="SAMPLES"
                  value={reading ? String(reading.sampleWindow) : '0'}
                  alignRight
                />''',
    'basic scanner metrics'
)
scanner = require_replace(
    scanner,
    "                  {assessment.ready ? 'Measurement ready to capture.' : scannerStatus.message}",
    "                  {reading?.rawVolumeMl > 0 ? 'Live raw measurement available.' : scannerStatus.message}",
    'basic scanner status'
)
scanner = require_replace(
    scanner,
    '                    Validated against distance, base quality, framing and temporal stability before capture.',
    '                    Basic raw reading. Advanced validation is intentionally disabled for now.',
    'capture hint'
)
scanner = scanner.replace("                  {canCapture ? 'Capture measurement' : assessment.headline}", "                  {canCapture ? 'Capture reading' : 'Waiting for depth'}", 1)
scanner = require_regex(
    scanner,
    r'''function estimateGrams\(reading: PortionDepthReading, density: DensityEstimate\) \{.*?\n\}''',
    '''function estimateGrams(reading: PortionDepthReading, density: DensityEstimate) {
  const volumeMl = reading.rawVolumeMl > 0 ? reading.rawVolumeMl : reading.estimatedVolumeMl;
  if (volumeMl <= 0) return 0;
  return volumeMl * density.gramsPerMl;
}''',
    'raw grams conversion'
)
scanner_path.write_text(scanner)

# ---------------- Native scanner: remove quality gates from sampling ----------------
native_path = Path('modules/portion-scanner/android/src/main/java/expo/modules/portionscanner/PortionDepthView.kt')
native = native_path.read_text()
native = require_regex(
    native,
    r'''      val geometryOk = hasDistance &&\n        distanceOk &&\n        baseOk &&\n        framingOk &&\n        estimate\.volumeMl >= MIN_REPORTABLE_VOLUME_ML''',
    '''      // BASIC MODE: geometry exists once the depth pipeline can produce a positive object volume.
      // Distance, framing, residual, confidence and stability stay diagnostic only.
      val geometryOk = estimate.volumeMl > 0.5 && estimate.heightMm > 0.0''',
    'native geometry gate'
)
native = require_regex(
    native,
    r'''      val ready = geometryOk &&\n        stabilized\.sampleWindow >= MIN_CAPTURE_FRAMES &&\n        stabilized\.stability >= MIN_REPORTABLE_STABILITY &&\n        stabilized\.confidence >= MIN_REPORTABLE_CONFIDENCE''',
    '''      val ready = geometryOk && stabilized.sampleWindow >= 1''',
    'native ready gate'
)
native = require_replace(
    native,
    '    if (!geometryOk || raw.confidence < MIN_HISTORY_CONFIDENCE) {',
    '    if (!geometryOk) {',
    'native history confidence gate'
)
basic_guidance = '''  private fun emitGuidance(
    surfaceDistance: SurfaceDistance,
    estimate: VolumeEstimate,
    stabilized: StabilizedEstimate,
    baseOk: Boolean,
    framingOk: Boolean,
    ready: Boolean
  ) {
    when {
      estimate.volumeMl <= 0.0 ->
        emitStatus("move", "Move slowly and keep one item inside the adjustable frame.")
      ready ->
        emitStatus("measuring", "Raw depth measurement is live. Capture whenever the value looks usable.")
      else ->
        emitStatus("tracking", "Depth detected. Hold briefly for a cleaner reading.")
    }
  }

  private fun estimateSurfaceDistance'''
native = require_regex(
    native,
    r'''  private fun emitGuidance\([\s\S]*?\n  private fun estimateSurfaceDistance''',
    basic_guidance,
    'native basic guidance'
)
native_path.write_text(native)
