/**
 * screens/profile-apps.tsx
 *
 * Page dédiée aux apps bloquées dans un profil.
 * Accessible depuis la carte profil via le bouton "Apps (X) →".
 *
 * Fonctionnalités :
 *   - Liste toutes les apps bloquées dans le profil avec icône, nom, package
 *   - Permet de débloquer une app (suppression de la règle dans le profil)
 *   - Bouton "Ajouter des apps" → navigue vers profile-detail
 *   - Indicateur visuel si le profil est actuellement actif
 */
import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { useTheme } from "@/theme";
import { AppRule, InstalledApp, Profile } from "@/types";
import { router, useLocalSearchParams } from "expo-router";
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
    RefreshControl,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppItem = InstalledApp & { rule: AppRule };

function pkgHue(pkg: string) {
  return pkg.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

// ── AppRow ─────────────────────────────────────────────────────────────────────
const AppRow = React.memo(function AppRow({
  item,
  onUnblock,
  profileColor,
}: {
  item: AppItem;
  onUnblock: (pkg: string) => void;
  profileColor: string;
}) {
  const { t } = useTheme();
  const hue = pkgHue(item.packageName);
  const color = `hsl(${hue}, 60%, 62%)`;
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      tension: 400,
      friction: 18,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      tension: 400,
      friction: 18,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, s.rowWrap]}>
      <View
        style={[
          s.row,
          { backgroundColor: t.bg.card, borderColor: t.blocked.border },
        ]}
      >
        {/* Accent bar */}
        <View style={[s.accentBar, { backgroundColor: t.blocked.accent }]} />

        {/* Icône */}
        <View style={s.iconWrap}>
          {item.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={s.iconImg}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                s.iconFallback,
                { backgroundColor: color + "1A", borderColor: color + "38" },
              ]}
            >
              <Text style={[s.iconLetter, { color }]}>
                {item.appName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.isSystemApp && (
            <View
              style={[
                s.sysBadge,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={[s.sysBadgeText, { color: t.text.muted }]}>SYS</Text>
            </View>
          )}
        </View>

        {/* Infos */}
        <View style={s.rowInfo}>
          <Text
            style={[
              s.appName,
              { color: t.text.secondary, textDecorationLine: "line-through" },
            ]}
            numberOfLines={1}
          >
            {item.appName}
          </Text>
          <Text style={[s.pkg, { color: t.text.muted }]} numberOfLines={1}>
            {item.packageName}
          </Text>
          <View
            style={[
              s.blockedTag,
              { backgroundColor: t.blocked.bg, borderColor: t.blocked.border },
            ]}
          >
            <Text style={[s.blockedTagText, { color: t.blocked.accent }]}>
              ● Bloquée dans ce profil
            </Text>
          </View>
        </View>

        {/* Bouton débloquer */}
        <TouchableOpacity
          style={[
            s.unblockBtn,
            { backgroundColor: t.danger.bg, borderColor: t.danger.border },
          ]}
          onPress={() => onUnblock(item.packageName)}
          onPressIn={pressIn}
          onPressOut={pressOut}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Text style={[s.unblockBtnText, { color: t.danger.accent }]}>
            Retirer
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ProfileAppsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

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
  }, [profileId]);

  const loadAll = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const [profiles, activeProfile] = await Promise.all([
        StorageService.getProfiles(),
        StorageService.getActiveProfile(),
      ]);

      const found = profiles.find((p) => p.id === profileId);
      if (!found) {
        router.back();
        return;
      }

      setProfile(found);
      setActiveId(activeProfile?.id ?? null);

      const blockedRules = (found.rules ?? []).filter((r) => r.isBlocked);

      // Essayer de charger les icônes depuis le cache
      const pkgs = blockedRules.map((r) => r.packageName);
      const installedMap = new Map<string, InstalledApp>();
      try {
        // Chercher dans le cache d'abord (rapide)
        const allApps = await AppListService.getAllApps();
        allApps.forEach((a) => installedMap.set(a.packageName, a));
        // Enrichir avec les icônes en arrière-plan
        AppListService.getAllAppsWithIcons()
          .then((full) => {
            const iconMap = new Map(full.map((a) => [a.packageName, a]));
            setApps((prev) =>
              prev.map((item) => ({
                ...item,
                icon: iconMap.get(item.packageName)?.icon ?? item.icon,
              })),
            );
          })
          .catch(() => {});
      } catch {}

      const result: AppItem[] = blockedRules.map((rule) => {
        const installed = installedMap.get(rule.packageName);
        return {
          packageName: rule.packageName,
          appName:
            installed?.appName ??
            rule.packageName.split(".").pop() ??
            rule.packageName,
          isSystemApp: installed?.isSystemApp ?? false,
          isWorkProfile: installed?.isWorkProfile ?? false,
          userId: installed?.userId ?? 0,
          icon: installed?.icon ?? null,
          rule,
        };
      });

      setApps(result.sort((a, b) => a.appName.localeCompare(b.appName)));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleUnblock = useCallback(
    (pkg: string) => {
      Alert.alert(
        "Retirer cette app ?",
        "Elle ne sera plus bloquée par ce profil.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Retirer",
            style: "destructive",
            onPress: async () => {
              if (!profile) return;
              const updated: Profile = {
                ...profile,
                rules: (profile.rules ?? []).filter(
                  (r) => r.packageName !== pkg,
                ),
              };
              await StorageService.saveProfile(updated);
              setProfile(updated);
              setApps((prev) => prev.filter((a) => a.packageName !== pkg));
            },
          },
        ],
      );
    },
    [profile],
  );

  const handleUnblockAll = useCallback(() => {
    if (!profile || apps.length === 0) return;
    Alert.alert(
      "Tout retirer ?",
      `Les ${apps.length} apps ne seront plus bloquées par ce profil.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout retirer",
          style: "destructive",
          onPress: async () => {
            const updated: Profile = { ...profile, rules: [] };
            await StorageService.saveProfile(updated);
            setProfile(updated);
            setApps([]);
          },
        },
      ],
    );
  }, [profile, apps]);

  const filteredApps = useMemo(() => {
    if (!query.trim()) return apps;
    const q = query.toLowerCase();
    return apps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }, [apps, query]);

  const isActive = profile?.id === activeId;

  // Couleur du profil dérivée depuis l'ID
  const profileHue = useMemo(() => pkgHue(profileId ?? ""), [profileId]);
  const profileColor = `hsl(${profileHue}, 60%, 55%)`;

  const keyExtractor = useCallback((item: AppItem) => item.packageName, []);
  const renderItem = useCallback(
    ({ item }: { item: AppItem }) => (
      <AppRow
        item={item}
        onUnblock={handleUnblock}
        profileColor={profileColor}
      />
    ),
    [handleUnblock, profileColor],
  );

  if (!profile && !loading) return null;

  return (
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── Header ── */}
      <View
        style={[
          s.header,
          { paddingTop: insets.top + 12, backgroundColor: profileColor + "E0" },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={s.headerMain}>
          <View>
            <View style={s.headerTitleRow}>
              <Text style={s.headerTitle} numberOfLines={1}>
                {profile?.name ?? "Profil"}
              </Text>
              {isActive && (
                <View style={s.activeBadge}>
                  <View style={s.activeDot} />
                  <Text style={s.activeBadgeText}>ACTIF</Text>
                </View>
              )}
            </View>
            <Text style={s.headerSub}>
              {apps.length} app{apps.length !== 1 ? "s" : ""} bloquée
              {apps.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {apps.length > 0 && (
            <TouchableOpacity
              style={s.clearAllBtn}
              onPress={handleUnblockAll}
              activeOpacity={0.8}
            >
              <Text style={s.clearAllBtnText}>Tout retirer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Barre de recherche */}
        <View style={[s.searchWrap, { backgroundColor: "rgba(0,0,0,0.2)" }]}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={[s.searchInput, { color: "#fff" }]}
            placeholder="Rechercher une app..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Contenu ── */}
      <Animated.View
        style={[
          { flex: 1 },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {apps.length === 0 && !loading ? (
          <View style={s.empty}>
            <View
              style={[
                s.emptyIconWrap,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={[s.emptyIcon, { color: t.text.link }]}>◎</Text>
            </View>
            <Text style={[s.emptyTitle, { color: t.text.primary }]}>
              Aucune app bloquée
            </Text>
            <Text style={[s.emptySub, { color: t.text.muted }]}>
              Ce profil ne bloque aucune application pour le moment.
            </Text>
            <TouchableOpacity
              style={[
                s.addBtn,
                {
                  backgroundColor: profileColor + "20",
                  borderColor: profileColor + "50",
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/screens/profile-detail",
                  params: { profileId },
                })
              }
              activeOpacity={0.85}
            >
              <Text style={[s.addBtnText, { color: profileColor }]}>
                + Ajouter des apps
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredApps}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={[
              s.list,
              { paddingBottom: insets.bottom + 80 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={t.refreshTint}
                colors={[t.refreshTint]}
                progressBackgroundColor={t.bg.card}
              />
            }
            ListHeaderComponent={
              filteredApps.length > 0 ? (
                <Text style={[s.listLabel, { color: t.text.muted }]}>
                  {filteredApps.length} APP{filteredApps.length > 1 ? "S" : ""}{" "}
                  BLOQUÉE{filteredApps.length > 1 ? "S" : ""}
                </Text>
              ) : query.trim() ? (
                <View style={s.noResult}>
                  <Text style={[s.noResultText, { color: t.text.muted }]}>
                    Aucune app correspondante
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </Animated.View>

      {/* ── FAB Ajouter ── */}
      {apps.length > 0 && (
        <TouchableOpacity
          style={[
            s.fab,
            { bottom: insets.bottom + 24, backgroundColor: profileColor },
          ]}
          onPress={() =>
            router.push({
              pathname: "/screens/profile-detail",
              params: { profileId },
            })
          }
          activeOpacity={0.85}
        >
          <Text style={s.fabText}>+ Ajouter</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingHorizontal: 18, paddingBottom: 14, gap: 10 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.6,
  },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.8,
  },
  clearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  clearAllBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "500" },

  // List
  list: { paddingHorizontal: 14, paddingTop: 14 },
  listLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 12,
    marginTop: 2,
  },
  noResult: { alignItems: "center", paddingTop: 40 },
  noResultText: { fontSize: 13 },

  // Row
  rowWrap: { marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingLeft: 17,
    paddingVertical: 12,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  iconWrap: { marginRight: 12, position: "relative" },
  iconImg: { width: 42, height: 42, borderRadius: 11 },
  iconFallback: {
    width: 42,
    height: 42,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  iconLetter: { fontSize: 17, fontWeight: "800" },
  sysBadge: {
    position: "absolute",
    bottom: -3,
    right: -5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  sysBadgeText: { fontSize: 6, fontWeight: "700", letterSpacing: 0.3 },
  rowInfo: { flex: 1, gap: 2 },
  appName: { fontSize: 13, fontWeight: "600" },
  pkg: { fontSize: 10, fontFamily: "monospace", opacity: 0.55 },
  blockedTag: {
    alignSelf: "flex-start",
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  blockedTagText: { fontSize: 9, fontWeight: "700" },
  unblockBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    marginLeft: 8,
  },
  unblockBtnText: { fontSize: 11, fontWeight: "700" },

  // Empty
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  addBtn: {
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderWidth: 1,
  },
  addBtnText: { fontSize: 14, fontWeight: "800" },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 8,
  },
  fabText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
