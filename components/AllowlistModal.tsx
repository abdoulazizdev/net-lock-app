import AppListService from "@/services/app-list.service";
import { Colors, useTheme } from "@/theme";
import { InstalledApp } from "@/types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    FlatList,
    Image,
    Modal,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = "name" | "status" | "package";
type FilterCategory = "all" | "allowed" | "blocked";

interface AllowlistModalProps {
  visible: boolean;
  onClose: () => void;
  allowedPackages: string[];
  onSave: (pkgs: string[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pkgHue = (pkg: string) =>
  pkg.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

// Catégories heuristiques basées sur le packageName
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AllowlistModal({
  visible,
  onClose,
  allowedPackages,
  onSave,
}: AllowlistModalProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  // ── State ────────────────────────────────────────────────────────────────
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(allowedPackages),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // ── Animations ───────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const filterHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelected(new Set(allowedPackages));
      setQuery("");
      setSortBy("name");
      setFilterCategory("all");
      setActiveGenre(null);
      setShowFilters(false);
      filterHeight.setValue(0);
      loadApps();
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, allowedPackages]);

  useEffect(() => {
    Animated.timing(filterHeight, {
      toValue: showFilters ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [showFilters]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const loadApps = async () => {
    setLoading(true);
    try {
      const user = await AppListService.getNonSystemApps();
      setApps(user.sort((a, b) => a.appName.localeCompare(b.appName)));
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

  // ── Genres disponibles ───────────────────────────────────────────────────
  const availableGenres = useMemo(() => {
    const genres = new Set(apps.map((a) => guessCategory(a.packageName)));
    return Array.from(genres).sort();
  }, [apps]);

  // ── Filtrage + tri avancés ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...apps];

    // 1. Recherche textuelle (nom + packageName)
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }

    // 2. Filtre statut (autorisé / bloqué)
    if (filterCategory === "allowed") {
      result = result.filter((a) => selected.has(a.packageName));
    } else if (filterCategory === "blocked") {
      result = result.filter((a) => !selected.has(a.packageName));
    }

    // 3. Filtre genre heuristique
    if (activeGenre) {
      result = result.filter(
        (a) => guessCategory(a.packageName) === activeGenre,
      );
    }

    // 4. Tri
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

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(Array.from(selected));
    setSaving(false);
    onClose();
  };

  // Sélectionner/désélectionner toutes les apps du filtre courant
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

  // ── Render ───────────────────────────────────────────────────────────────
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
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
              maxHeight: "94%",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: t.border.normal }]} />

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIcon,
                  {
                    backgroundColor: Colors.green[50],
                    borderColor: Colors.green[100],
                  },
                ]}
              >
                <Text style={{ fontSize: 18 }}>✅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: t.text.primary }]}>
                  Apps autorisées
                </Text>
                <Text style={[styles.sub, { color: t.text.muted }]}>
                  {selected.size} autorisée{selected.size > 1 ? "s" : ""} ·{" "}
                  {apps.length - selected.size} bloquée
                  {apps.length - selected.size > 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: t.bg.cardAlt }]}
            >
              <Text
                style={{ fontSize: 11, color: t.text.muted, fontWeight: "700" }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Avertissement ── */}
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: Colors.amber[50],
                borderColor: Colors.amber[100],
              },
            ]}
          >
            <Text style={{ fontSize: 13 }}>⚠</Text>
            <Text style={[styles.infoText, { color: Colors.amber[600] }]}>
              Seules les apps cochées auront accès à internet. Pensez à inclure
              vos apps essentielles.
            </Text>
          </View>

          {/* ── Barre de recherche ── */}
          <View
            style={[
              styles.searchBox,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            <Text style={{ fontSize: 13, color: t.text.muted }}>◎</Text>
            <TextInput
              style={[styles.searchInput, { color: t.text.primary }]}
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
                  style={{
                    fontSize: 12,
                    color: t.text.muted,
                    fontWeight: "700",
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            )}
            {/* Bouton filtres avancés */}
            <TouchableOpacity
              onPress={() => setShowFilters((v) => !v)}
              style={[
                styles.filterToggleBtn,
                {
                  backgroundColor: showFilters
                    ? (Colors.blue[500] ?? "#3b82f6")
                    : t.bg.card,
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

          {/* ── Panneau filtres avancés ── */}
          <Animated.View
            style={{
              overflow: "hidden",
              maxHeight: filterHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 260],
              }),
            }}
          >
            <View
              style={[
                styles.filtersPanel,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              {/* Tri */}
              <Text
                style={[styles.filterSectionLabel, { color: t.text.muted }]}
              >
                TRIER PAR
              </Text>
              <View style={styles.filterRow}>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor:
                          sortBy === opt.key
                            ? (Colors.blue[500] ?? "#3b82f6")
                            : t.bg.card,
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
                        styles.filterChipText,
                        {
                          color: sortBy === opt.key ? "#fff" : t.text.secondary,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Filtre statut */}
              <Text
                style={[
                  styles.filterSectionLabel,
                  { color: t.text.muted, marginTop: 10 },
                ]}
              >
                AFFICHER
              </Text>
              <View style={styles.filterRow}>
                {FILTER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor:
                          filterCategory === opt.key
                            ? opt.color + "22"
                            : t.bg.card,
                        borderColor:
                          filterCategory === opt.key
                            ? opt.color
                            : t.border.light,
                      },
                    ]}
                    onPress={() => setFilterCategory(opt.key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
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

              {/* Filtre genre */}
              <Text
                style={[
                  styles.filterSectionLabel,
                  { color: t.text.muted, marginTop: 10 },
                ]}
              >
                CATÉGORIE
              </Text>
              <View style={[styles.filterRow, { flexWrap: "wrap" }]}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        activeGenre === null
                          ? (Colors.blue[500] ?? "#3b82f6")
                          : t.bg.card,
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
                      styles.filterChipText,
                      {
                        color: activeGenre === null ? "#fff" : t.text.secondary,
                      },
                    ]}
                  >
                    Toutes
                  </Text>
                </TouchableOpacity>
                {availableGenres.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor:
                          activeGenre === genre
                            ? (Colors.purple[50] ?? "#faf5ff")
                            : t.bg.card,
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
                        styles.filterChipText,
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

          {/* ── Résumé filtre actif + sélection rapide ── */}
          <View style={styles.quickBtnsRow}>
            <Text style={[styles.filteredCount, { color: t.text.muted }]}>
              {filtered.length} app{filtered.length > 1 ? "s" : ""} affichée
              {filtered.length > 1 ? "s" : ""}
            </Text>
            <View style={styles.quickBtns}>
              <TouchableOpacity
                style={[
                  styles.quickBtn,
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
                    styles.quickBtnText,
                    { color: t.allowed?.text ?? Colors.green[600] },
                  ]}
                >
                  ✓ Tout cocher
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickBtn,
                  {
                    backgroundColor: t.danger.bg,
                    borderColor: t.danger.border,
                  },
                ]}
                onPress={deselectFiltered}
                activeOpacity={0.8}
              >
                <Text style={[styles.quickBtnText, { color: t.danger.text }]}>
                  ✕ Tout décocher
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Liste ── */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <Text style={{ color: t.text.muted }}>Chargement…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.loadingWrap}>
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
                paddingBottom: 8,
              }}
              renderItem={({ item }) => {
                const isAllowed = selected.has(item.packageName);
                const hue = pkgHue(item.packageName);
                const iconColor = `hsl(${hue}, 60%, 62%)`;
                const genre = guessCategory(item.packageName);
                return (
                  <TouchableOpacity
                    style={[
                      styles.appRow,
                      {
                        backgroundColor: isAllowed
                          ? (t.allowed?.bg ?? Colors.green[50])
                          : t.bg.cardAlt,
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
                        style={styles.appIcon}
                      />
                    ) : (
                      <View
                        style={[
                          styles.appIconFallback,
                          {
                            backgroundColor: iconColor + "1A",
                            borderColor: iconColor + "38",
                          },
                        ]}
                      >
                        <Text
                          style={[styles.appIconLetter, { color: iconColor }]}
                        >
                          {item.appName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.appNameRow}>
                        <Text
                          style={[styles.appName, { color: t.text.primary }]}
                          numberOfLines={1}
                        >
                          {item.appName}
                        </Text>
                        <Text
                          style={[styles.genreTag, { color: t.text.muted }]}
                        >
                          {genre}
                        </Text>
                      </View>
                      <Text
                        style={[styles.appPkg, { color: t.text.muted }]}
                        numberOfLines={1}
                      >
                        {item.packageName}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: t.border.normal },
                        isAllowed && {
                          backgroundColor:
                            t.allowed?.accent ?? Colors.green[400],
                          borderColor: t.allowed?.accent ?? Colors.green[400],
                        },
                      ]}
                    >
                      {isAllowed && <Text style={styles.checkboxText}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: Colors.green[400] },
                (saving || selected.size === 0) && { opacity: 0.5 },
              ]}
              onPress={handleSave}
              disabled={saving || selected.size === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>
                {saving
                  ? "Application en cours…"
                  : `✓ Autoriser ${selected.size} app${selected.size > 1 ? "s" : ""}`}
              </Text>
            </TouchableOpacity>
            {selected.size === 0 && (
              <Text style={[styles.emptyHint, { color: t.text.muted }]}>
                Sélectionnez au moins une app
              </Text>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  sub: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { fontSize: 12, lineHeight: 17, flex: 1 },

  // Recherche
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
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

  // Panneau filtres
  filtersPanel: {
    marginHorizontal: 16,
    marginBottom: 10,
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

  // Sélection rapide
  quickBtnsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
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

  // Liste
  loadingWrap: { paddingVertical: 32, alignItems: "center" },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
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

  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  saveBtn: { borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  emptyHint: { fontSize: 11, textAlign: "center" },
});
