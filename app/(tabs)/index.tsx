import FocusBanner from "@/components/FocusBanner";
import FocusModal from "@/components/FocusModal";
import HomeScreenSkeleton from "@/components/HomeScreenSkeleton";
import SearchAndFilters, { FilterKey } from "@/components/SearchAndFilters";
import AppListService from "@/services/app-list.service";
import FocusService, { FocusStatus } from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { AppRule, InstalledApp } from "@/types";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppItem = InstalledApp & { rule?: AppRule };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [query, setQuery] = useState("");
  // Fix 1 : activeFilters est un tableau de FilterKey (compatible avec la nouvelle SearchAndFilters)
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [systemAppsLoaded, setSystemAppsLoaded] = useState(false);
  const [systemAppsLoading, setSystemAppsLoading] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusStatus, setFocusStatus] = useState<FocusStatus | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadInitial();
    checkFocus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appState.current !== "active") {
        refreshRules();
        checkFocus();
      }
      appState.current = state;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [apps, query, activeFilters]);

  const checkFocus = async () => {
    try {
      const status = await FocusService.getStatus();
      setFocusStatus(status.isActive ? status : null);
    } catch {
      setFocusStatus(null);
    }
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [rules, isVpn] = await Promise.all([
        StorageService.getRules(),
        VpnService.isVpnActive(),
      ]);
      setVpnActive(isVpn);
      setBlockedCount(rules.filter((r) => r.isBlocked).length);

      // Fix 2 : getAppsProgressive utilise un callback, on le wrappe en Promise
      const userApps = await new Promise<InstalledApp[]>((resolve) => {
        AppListService.getAppsProgressive((apps: InstalledApp[]) =>
          resolve(apps),
        );
      });
      setApps(mergeAppsRules(userApps, rules));
    } finally {
      setLoading(false);
    }

    // Charger les apps système en arrière-plan (callback style)
    setSystemAppsLoading(true);
    AppListService.getAppsProgressive((allApps: InstalledApp[]) => {
      setSystemAppsLoaded(true);
      setSystemAppsLoading(false);
      StorageService.getRules().then((rules) => {
        setApps(mergeAppsRules(allApps, rules));
      });
    });
  };

  const refreshRules = async () => {
    const [rules, isVpn] = await Promise.all([
      StorageService.getRules(),
      VpnService.isVpnActive(),
    ]);
    setVpnActive(isVpn);
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setApps((prev) => mergeAppsRules(prev, rules));
  };

  const mergeAppsRules = (
    appsList: InstalledApp[],
    rules: AppRule[],
  ): AppItem[] => {
    const map = new Map(rules.map((r) => [r.packageName, r]));
    return appsList.map((a) => ({ ...a, rule: map.get(a.packageName) }));
  };

  // Fix 3 : logique de filtrage adaptée au tableau activeFilters
  const applyFilters = () => {
    let list = [...apps];

    // Filtre système : on l'affiche seulement si le filtre "system" est actif
    const showSystem = activeFilters.includes("system");
    if (!showSystem) list = list.filter((a) => !a.isSystemApp);

    // Filtre texte
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }

    // Filtres blocked / allowed (cumulables)
    if (
      activeFilters.includes("blocked") &&
      !activeFilters.includes("allowed")
    ) {
      list = list.filter((a) => a.rule?.isBlocked);
    } else if (
      activeFilters.includes("allowed") &&
      !activeFilters.includes("blocked")
    ) {
      list = list.filter((a) => !a.rule?.isBlocked);
    }
    // Si les deux sont actifs → on garde tout (annule l'un l'autre)

    setFilteredApps(list);
  };

  const toggleVpn = async () => {
    if (vpnActive) await VpnService.stopVpn();
    else await VpnService.startVpn();
    setVpnActive(!vpnActive);
  };

  const toggleBlock = async (item: AppItem) => {
    const current = item.rule?.isBlocked ?? false;
    // Fix 4 : on utilise VpnService.setRule qui gère storage + sync VPN en interne
    // Pas besoin d'appeler syncBlockedApps séparément
    await VpnService.setRule(item.packageName, !current);
    await refreshRules();
  };

  const renderApp = useCallback(
    ({ item }: { item: AppItem }) => {
      const blocked = item.rule?.isBlocked ?? false;
      return (
        <TouchableOpacity
          style={st.appRow}
          onPress={() =>
            router.push({
              pathname: "/screens/app-detail",
              params: { packageName: item.packageName },
            })
          }
          activeOpacity={0.75}
        >
          <View style={st.appIconWrap}>
            <Text style={st.appIconText}>
              {item.appName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={st.appInfo}>
            <Text style={st.appName} numberOfLines={1}>
              {item.appName}
            </Text>
            <Text style={st.appPkg} numberOfLines={1}>
              {item.packageName}
            </Text>
          </View>
          <TouchableOpacity
            style={[st.blockBtn, blocked ? st.blockBtnOn : st.blockBtnOff]}
            onPress={() => toggleBlock(item)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                st.blockBtnText,
                blocked ? st.blockBtnTextOn : st.blockBtnTextOff,
              ]}
            >
              {blocked ? "Bloqué" : "Libre"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [vpnActive],
  );

  if (loading) return <HomeScreenSkeleton />;

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <View style={st.headerRow}>
          <View>
            <Text style={st.headerTitle}>NetOff</Text>
            <Text style={st.headerSub}>
              {blockedCount} app{blockedCount > 1 ? "s" : ""} bloquée
              {blockedCount > 1 ? "s" : ""}
            </Text>
          </View>
          <View style={st.headerActions}>
            <TouchableOpacity
              style={[st.focusBtn, focusStatus && st.focusBtnActive]}
              onPress={() => {
                if (!focusStatus) setFocusVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={st.focusBtnText}>
                {focusStatus ? "🎯 EN COURS" : "🎯 Focus"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.vpnBtn, vpnActive ? st.vpnBtnOn : st.vpnBtnOff]}
              onPress={toggleVpn}
              activeOpacity={0.85}
            >
              <View
                style={[
                  st.vpnDot,
                  { backgroundColor: vpnActive ? "#3DDB8A" : "#D04070" },
                ]}
              />
              <Text
                style={[
                  st.vpnBtnText,
                  { color: vpnActive ? "#3DDB8A" : "#D04070" },
                ]}
              >
                {vpnActive ? "VPN ON" : "VPN OFF"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.packageName}
        renderItem={renderApp}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View>
            {focusStatus && (
              <FocusBanner
                status={focusStatus}
                onStopped={() => {
                  setFocusStatus(null);
                  refreshRules();
                }}
              />
            )}
            <SearchAndFilters
              query={query}
              onQueryChange={setQuery}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              systemAppsLoaded={systemAppsLoaded}
              systemAppsLoading={systemAppsLoading}
            />
            <Text style={st.countLabel}>
              {filteredApps.length} application
              {filteredApps.length > 1 ? "s" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <Text style={st.emptyIcon}>🔍</Text>
            <Text style={st.emptyText}>Aucune application trouvée</Text>
          </View>
        }
      />

      <FocusModal
        visible={focusVisible}
        onClose={() => setFocusVisible(false)}
        onStarted={() => {
          checkFocus();
          refreshRules();
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.2,
  },
  headerSub: {
    fontSize: 11,
    color: "#3A3A58",
    marginTop: 2,
    fontWeight: "500",
  },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  focusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  focusBtnActive: { backgroundColor: "#7B6EF620", borderColor: "#7B6EF6" },
  focusBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7B6EF6",
    letterSpacing: 0.3,
  },
  vpnBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  vpnBtnOn: { backgroundColor: "#0A0E0C", borderColor: "#1E6A46" },
  vpnBtnOff: { backgroundColor: "#0E0A0C", borderColor: "#251520" },
  vpnDot: { width: 6, height: 6, borderRadius: 3 },
  vpnBtnText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  list: { paddingHorizontal: 22, paddingTop: 14 },
  countLabel: {
    fontSize: 10,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  appIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#16161E",
    justifyContent: "center",
    alignItems: "center",
  },
  appIconText: { fontSize: 18, fontWeight: "700", color: "#5A5A80" },
  appInfo: { flex: 1 },
  appName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 2,
  },
  appPkg: { fontSize: 10, color: "#2E2E48" },
  blockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  blockBtnOn: { backgroundColor: "#14080A", borderColor: "#4A1A2A" },
  blockBtnOff: { backgroundColor: "#0A140A", borderColor: "#1A3A1A" },
  blockBtnText: { fontSize: 11, fontWeight: "700" },
  blockBtnTextOn: { color: "#D04070" },
  blockBtnTextOff: { color: "#3DDB8A" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#2E2E48", fontWeight: "600" },
});
