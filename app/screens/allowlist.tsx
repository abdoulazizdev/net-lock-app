// app/screens/allowlist.tsx
import AllowlistService from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import AppListService from "@/services/app-list.service";
import { Colors, Semantic, useTheme } from "@/theme";
import { InstalledApp } from "@/types";
import { router } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SortOption = "name" | "status" | "package";
type FilterCategory = "all" | "allowed" | "blocked";

const pkgHue = (pkg: string) =>
  pkg.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

function guessCategory(pkg: string): string {
  if (/\.browser|chrome|firefox|opera|brave|edge/i.test(pkg))
    return "🌐 Navigation";
  if (
    /social|instagram|facebook|twitter|tiktok|snapchat|whatsapp|telegram|signal|messenger|discord/i.test(
      pkg,
    )
  )
    return "💬 Réseaux sociaux";
  if (/mail|gmail|outlook|email|proton/i.test(pkg)) return "📧 Email";
  if (
    /music|spotify|deezer|youtube|netflix|video|media|player|vlc|prime/i.test(
      pkg,
    )
  )
    return "🎵 Médias";
  if (/game|gaming|play\.|chess|sudoku|puzzle/i.test(pkg)) return "🎮 Jeux";
  if (/bank|pay|finance|wallet|revolut|n26|lydia|paypal/i.test(pkg))
    return "💳 Finance";
  if (/map|navigation|waze|uber|lyft|bolt|taxi/i.test(pkg))
    return "🗺 Navigation";
  if (
    /work|office|docs|drive|dropbox|notion|slack|teams|zoom|meet|calendar/i.test(
      pkg,
    )
  )
    return "💼 Travail";
  if (/shop|amazon|ebay|aliexpress|zalando|market/i.test(pkg))
    return "🛍 Shopping";
  if (/health|fitness|sport|strava|running|workout/i.test(pkg))
    return "🏃 Santé";
  if (/news|info|rss|flipboard|feedly|press/i.test(pkg)) return "📰 Actualités";
  return "📱 Autre";
}

export default function AllowlistScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialEnabled, setInitialEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const filterHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(filterHeight, {
      toValue: showFilters ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [showFilters]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [state, userApps] = await Promise.all([
        AllowlistService.getState(),
        AppListService.getNonSystemApps(),
      ]);
      setInitialEnabled(state.enabled);
      setSelected(new Set(state.packages));
      setApps(userApps.sort((a, b) => a.appName.localeCompare(b.appName)));
      // Load icons in background
      AppListService.getNonSystemAppsWithIcons()
        .then((full) => {
          setApps((prev) => {
            const fm = new Map(full.map((a) => [a.packageName, a]));
            return prev.map((a) => ({
              ...a,
              icon: fm.get(a.packageName)?.icon ?? a.icon,
            }));
          });
        })
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const availableGenres = useMemo(() => {
    const genres = new Set(apps.map((a) => guessCategory(a.packageName)));
    return Array.from(genres).sort();
  }, [apps]);

  const filtered = useMemo(() => {
    let result = [...apps];
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }
    if (filterCategory === "allowed")
      result = result.filter((a) => selected.has(a.packageName));
    else if (filterCategory === "blocked")
      result = result.filter((a) => !selected.has(a.packageName));
    if (activeGenre)
      result = result.filter(
        (a) => guessCategory(a.packageName) === activeGenre,
      );
    result.sort((a, b) => {
      if (sortBy === "name")
        return a.appName.localeCompare(b.appName, "fr", {
          sensitivity: "base",
        });
      if (sortBy === "package")
        return a.packageName.localeCompare(b.packageName);
      if (sortBy === "status") {
        const aS = selected.has(a.packageName) ? 0 : 1;
        const bS = selected.has(b.packageName) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return a.appName.localeCompare(b.appName, "fr", {
          sensitivity: "base",
        });
      }
      return 0;
    });
    return result;
  }, [apps, query, filterCategory, activeGenre, sortBy, selected]);

  const toggle = useCallback((pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });
  }, []);

  const selectFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((a) => next.add(a.packageName));
      return next;
    });

  const deselectFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((a) => next.delete(a.packageName));
      return next;
    });

  const handleDisable = () => {
    Alert.alert(
      "Désactiver le mode Liste blanche ?",
      "Le blocage reviendra en mode normal.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: async () => {
            await AllowlistService.disable();
            AppEvents.emit("allowlist:changed", false);
            AppEvents.emit("rules:changed", undefined);
            router.back();
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      if (initialEnabled) {
        await AllowlistService.updateAllowedPackages(Array.from(selected));
      } else {
        await AllowlistService.enable(Array.from(selected));
      }
      AppEvents.emit("allowlist:changed", true);
      AppEvents.emit("rules:changed", undefined);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const SORT_OPTIONS: { key: SortOption; label: string }[] = [
    { key: "name", label: "Nom" },
    { key: "status", label: "Statut" },
    { key: "package", label: "Package" },
  ];

  const FILTER_OPTIONS: {
    key: FilterCategory;
    label: string;
    color: string;
  }[] = [
    { key: "all", label: `Toutes (${apps.length})`, color: t.text.secondary },
    {
      key: "allowed",
      label: `✓ Autorisées (${selected.size})`,
      color: Colors.green[500] ?? "#22c55e",
    },
    {
      key: "blocked",
      label: `✕ Bloquées (${apps.length - selected.size})`,
      color: t.danger.text,
    },
  ];

  return (
    <View style={[p.root, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── Header ── */}
      <View
        style={[
          p.header,
          { paddingTop: insets.top + 10, backgroundColor: Semantic.bg.header },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={p.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={p.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={p.headerRow}>
          <View style={p.headerLeft}>
            <View style={p.headerIconWrap}>
              <Text style={p.headerIconText}>✅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={p.headerTitle}>Liste blanche</Text>
              <Text style={p.headerSub}>
                {selected.size} autorisée{selected.size > 1 ? "s" : ""} ·{" "}
                {apps.length - selected.size} bloquée
                {apps.length - selected.size > 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {initialEnabled && (
            <TouchableOpacity
              style={p.disableBtn}
              onPress={handleDisable}
              activeOpacity={0.8}
            >
              <Text style={p.disableBtnText}>Désactiver</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress bar */}
        <View
          style={[
            p.progressTrack,
            { backgroundColor: "rgba(255,255,255,0.08)" },
          ]}
        >
          <View
            style={[
              p.progressFill,
              {
                width:
                  apps.length > 0
                    ? (`${Math.round((selected.size / apps.length) * 100)}%` as any)
                    : "0%",
                backgroundColor:
                  selected.size > 0 ? "#34d399" : "rgba(255,255,255,0.15)",
              },
            ]}
          />
          <Text style={p.progressLabel}>
            {apps.length > 0
              ? `${Math.round((selected.size / apps.length) * 100)}% des apps autorisées`
              : "Aucune app chargée"}
          </Text>
        </View>
      </View>

      <Animated.View
        style={[
          {
            flex: 1,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* ── Avertissement ── */}
        <View
          style={[
            p.infoBanner,
            {
              backgroundColor: Colors.amber[50],
              borderColor: Colors.amber[100],
            },
          ]}
        >
          <Text style={{ fontSize: 13 }}>⚠</Text>
          <Text style={[p.infoText, { color: Colors.amber[600] }]}>
            Seules les apps cochées auront accès à internet. Pensez à inclure
            vos apps essentielles.
          </Text>
        </View>

        {/* ── Barre de recherche ── */}
        <View
          style={[
            p.searchBox,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <Text style={{ fontSize: 13, color: t.text.muted }}>◎</Text>
          <TextInput
            style={[p.searchInput, { color: t.text.primary }]}
            placeholder="Rechercher une application…"
            placeholderTextColor={t.text.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Text
                style={{ fontSize: 12, color: t.text.muted, fontWeight: "700" }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            style={[
              p.filterToggleBtn,
              {
                backgroundColor: showFilters
                  ? (Colors.blue[500] ?? "#3b82f6")
                  : t.bg.cardAlt,
                borderColor: showFilters
                  ? (Colors.blue[400] ?? "#60a5fa")
                  : t.border.light,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: showFilters ? "#fff" : t.text.muted,
              }}
            >
              ⚙ Filtres
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Panneau filtres ── */}
        <Animated.View
          style={{
            overflow: "hidden",
            maxHeight: filterHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 280],
            }),
          }}
        >
          <View
            style={[
              p.filtersPanel,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <Text style={[p.filterSectionLabel, { color: t.text.muted }]}>
              TRIER PAR
            </Text>
            <View style={p.filterRow}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    p.filterChip,
                    {
                      backgroundColor:
                        sortBy === opt.key
                          ? (Colors.blue[500] ?? "#3b82f6")
                          : t.bg.cardAlt,
                      borderColor:
                        sortBy === opt.key
                          ? (Colors.blue[400] ?? "#60a5fa")
                          : t.border.light,
                    },
                  ]}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text
                    style={[
                      p.filterChipText,
                      { color: sortBy === opt.key ? "#fff" : t.text.secondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[
                p.filterSectionLabel,
                { color: t.text.muted, marginTop: 10 },
              ]}
            >
              AFFICHER
            </Text>
            <View style={p.filterRow}>
              {FILTER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    p.filterChip,
                    {
                      backgroundColor:
                        filterCategory === opt.key
                          ? opt.color + "22"
                          : t.bg.cardAlt,
                      borderColor:
                        filterCategory === opt.key ? opt.color : t.border.light,
                    },
                  ]}
                  onPress={() => setFilterCategory(opt.key)}
                >
                  <Text
                    style={[
                      p.filterChipText,
                      {
                        color:
                          filterCategory === opt.key
                            ? opt.color
                            : t.text.secondary,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[
                p.filterSectionLabel,
                { color: t.text.muted, marginTop: 10 },
              ]}
            >
              CATÉGORIE
            </Text>
            <View style={[p.filterRow, { flexWrap: "wrap" }]}>
              <TouchableOpacity
                style={[
                  p.filterChip,
                  {
                    backgroundColor:
                      activeGenre === null
                        ? (Colors.blue[500] ?? "#3b82f6")
                        : t.bg.cardAlt,
                    borderColor:
                      activeGenre === null
                        ? (Colors.blue[400] ?? "#60a5fa")
                        : t.border.light,
                  },
                ]}
                onPress={() => setActiveGenre(null)}
              >
                <Text
                  style={[
                    p.filterChipText,
                    { color: activeGenre === null ? "#fff" : t.text.secondary },
                  ]}
                >
                  Toutes
                </Text>
              </TouchableOpacity>
              {availableGenres.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    p.filterChip,
                    {
                      backgroundColor:
                        activeGenre === genre
                          ? (Colors.purple[50] ?? "#faf5ff")
                          : t.bg.cardAlt,
                      borderColor:
                        activeGenre === genre
                          ? (Colors.purple[400] ?? "#a855f7")
                          : t.border.light,
                    },
                  ]}
                  onPress={() =>
                    setActiveGenre(activeGenre === genre ? null : genre)
                  }
                >
                  <Text
                    style={[
                      p.filterChipText,
                      {
                        color:
                          activeGenre === genre
                            ? (Colors.purple[600] ?? "#9333ea")
                            : t.text.secondary,
                      },
                    ]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── Résumé + sélection rapide ── */}
        <View style={p.quickBtnsRow}>
          <Text style={[p.filteredCount, { color: t.text.muted }]}>
            {filtered.length} app{filtered.length > 1 ? "s" : ""} affichée
            {filtered.length > 1 ? "s" : ""}
          </Text>
          <View style={p.quickBtns}>
            <TouchableOpacity
              style={[
                p.quickBtn,
                {
                  backgroundColor: t.allowed?.bg ?? Colors.green[50],
                  borderColor: t.allowed?.border ?? Colors.green[100],
                },
              ]}
              onPress={selectFiltered}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  p.quickBtnText,
                  { color: t.allowed?.text ?? Colors.green[600] },
                ]}
              >
                ✓ Tout cocher
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                p.quickBtn,
                { backgroundColor: t.danger.bg, borderColor: t.danger.border },
              ]}
              onPress={deselectFiltered}
              activeOpacity={0.8}
            >
              <Text style={[p.quickBtnText, { color: t.danger.text }]}>
                ✕ Tout décocher
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Liste ── */}
        {loading ? (
          <View style={p.loadingWrap}>
            <Text style={{ color: t.text.muted }}>Chargement…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={p.loadingWrap}>
            <Text style={{ fontSize: 22, marginBottom: 8 }}>◎</Text>
            <Text style={{ color: t.text.muted, fontSize: 13 }}>
              Aucune app ne correspond
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(a) => a.packageName}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
            }}
            renderItem={({ item }) => {
              const isAllowed = selected.has(item.packageName);
              const hue = pkgHue(item.packageName);
              const iconColor = `hsl(${hue}, 60%, 62%)`;
              const genre = guessCategory(item.packageName);
              return (
                <TouchableOpacity
                  style={[
                    p.appRow,
                    {
                      backgroundColor: isAllowed
                        ? (t.allowed?.bg ?? Colors.green[50])
                        : t.bg.card,
                      borderColor: isAllowed
                        ? (t.allowed?.border ?? Colors.green[100])
                        : t.border.light,
                    },
                  ]}
                  onPress={() => toggle(item.packageName)}
                  activeOpacity={0.8}
                >
                  {item.icon ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${item.icon}` }}
                      style={p.appIcon}
                    />
                  ) : (
                    <View
                      style={[
                        p.appIconFallback,
                        {
                          backgroundColor: iconColor + "1A",
                          borderColor: iconColor + "38",
                        },
                      ]}
                    >
                      <Text style={[p.appIconLetter, { color: iconColor }]}>
                        {item.appName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={p.appNameRow}>
                      <Text
                        style={[p.appName, { color: t.text.primary }]}
                        numberOfLines={1}
                      >
                        {item.appName}
                      </Text>
                      <Text style={[p.genreTag, { color: t.text.muted }]}>
                        {genre}
                      </Text>
                    </View>
                    <Text
                      style={[p.appPkg, { color: t.text.muted }]}
                      numberOfLines={1}
                    >
                      {item.packageName}
                    </Text>
                  </View>
                  <View
                    style={[
                      p.checkbox,
                      { borderColor: t.border.normal },
                      isAllowed && {
                        backgroundColor: t.allowed?.accent ?? Colors.green[400],
                        borderColor: t.allowed?.accent ?? Colors.green[400],
                      },
                    ]}
                  >
                    {isAllowed && <Text style={p.checkboxText}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </Animated.View>

      {/* ── Footer fixe ── */}
      <View
        style={[
          p.footer,
          {
            backgroundColor: t.bg.card,
            borderTopColor: t.border.light,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            p.saveBtn,
            { backgroundColor: Colors.green[400] },
            (saving || selected.size === 0) && { opacity: 0.5 },
          ]}
          onPress={handleSave}
          disabled={saving || selected.size === 0}
          activeOpacity={0.85}
        >
          <Text style={p.saveBtnText}>
            {saving
              ? "Application en cours…"
              : `✓ ${initialEnabled ? "Mettre à jour" : "Activer"} · ${selected.size} app${selected.size > 1 ? "s" : ""}`}
          </Text>
        </TouchableOpacity>
        {selected.size === 0 && (
          <Text style={[p.emptyHint, { color: t.text.muted }]}>
            Sélectionnez au moins une app
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
    shadowColor: "#040d1e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 16,
  },
  backBtn: { marginBottom: 4 },
  backText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: { fontSize: 20 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
    marginTop: 1,
  },
  disableBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(248,113,113,0.15)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.4)",
  },
  disableBtnText: { fontSize: 12, fontWeight: "700", color: "#f87171" },
  progressTrack: {
    height: 22,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.75,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.52)",
    textAlign: "center",
    letterSpacing: 0.4,
    zIndex: 1,
    paddingHorizontal: 6,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { fontSize: 12, lineHeight: 17, flex: 1 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  filterToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  filtersPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterSectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 7,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: "600" },
  quickBtnsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  filteredCount: { fontSize: 11, fontWeight: "500" },
  quickBtns: { flexDirection: "row", gap: 8 },
  quickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 11, fontWeight: "700" },
  loadingWrap: { paddingVertical: 32, alignItems: "center" },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  appIcon: { width: 40, height: 40, borderRadius: 11 },
  appIconFallback: {
    width: 40,
    height: 40,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  appIconLetter: { fontSize: 16, fontWeight: "800" },
  appNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  appName: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  genreTag: { fontSize: 9, fontWeight: "600", opacity: 0.7, flexShrink: 0 },
  appPkg: { fontSize: 10, fontFamily: "monospace", opacity: 0.6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxText: { fontSize: 11, color: "#fff", fontWeight: "800" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  saveBtn: { borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  emptyHint: { fontSize: 11, textAlign: "center" },
});
