import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { AppRule, InstalledApp, Profile } from "@/types";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";

export default function ProfileRulesScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blockedInProfile, setBlockedInProfile] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const allApps = await AppListService.getInstalledApps();
    setApps(allApps.filter((a) => !a.isSystemApp));

    const profiles = await StorageService.getProfiles();
    const p = profiles.find((p) => p.id === profileId);
    setProfile(p || null);
    if (p) {
      setBlockedInProfile(
        new Set(p.rules.filter((r) => r.isBlocked).map((r) => r.packageName)),
      );
    }
    setLoading(false);
  };

  const toggleRule = async (packageName: string) => {
    if (!profile) return;
    const isCurrentlyBlocked = blockedInProfile.has(packageName);
    const newBlocked = !isCurrentlyBlocked;

    const updatedRules: AppRule[] = [
      ...profile.rules.filter((r) => r.packageName !== packageName),
    ];
    updatedRules.push({
      packageName,
      isBlocked: newBlocked,
      profileId: profile.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updatedProfile = { ...profile, rules: updatedRules };
    await StorageService.saveProfile(updatedProfile);
    setProfile(updatedProfile);
    setBlockedInProfile((prev) => {
      const updated = new Set(prev);
      newBlocked ? updated.add(packageName) : updated.delete(packageName);
      return updated;
    });
  };

  const filtered = apps.filter((a) =>
    a.appName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderItem = ({ item }: { item: InstalledApp }) => {
    const isBlocked = blockedInProfile.has(item.packageName);
    return (
      <TouchableOpacity
        style={styles.appCard}
        onPress={() => toggleRule(item.packageName)}
        activeOpacity={0.7}
      >
        <View style={styles.appIconContainer}>
          {item.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={styles.appIcon}
            />
          ) : (
            <View style={styles.appIconPlaceholder}>
              <Text style={styles.appIconLetter}>{item.appName.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{item.appName}</Text>
          <Text style={styles.appPackage} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>
        <View
          style={[
            styles.toggle,
            isBlocked ? styles.toggleBlocked : styles.toggleAllowed,
          ]}
        >
          <View
            style={[
              styles.toggleThumb,
              isBlocked ? styles.thumbBlocked : styles.thumbAllowed,
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.name || "Profil"}</Text>
        <Text style={styles.headerSubtitle}>
          {blockedInProfile.size} app(s) bloquée(s) dans ce profil
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.searchPlaceholder} onPress={() => {}}>
            {searchQuery || "Rechercher..."}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={{ color: "#555" }}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.packageName}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { marginBottom: 16 },
  backBtnText: { color: "#00F5A0", fontSize: 15, fontWeight: "600" },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  headerSubtitle: { fontSize: 13, color: "#555", marginTop: 4 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161E",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchPlaceholder: { color: "#555", fontSize: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  appCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  appIconContainer: { marginRight: 14 },
  appIcon: { width: 44, height: 44, borderRadius: 11 },
  appIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: "#1E1E2E",
    justifyContent: "center",
    alignItems: "center",
  },
  appIconLetter: { fontSize: 18, fontWeight: "800", color: "#00F5A0" },
  appInfo: { flex: 1 },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  appPackage: { fontSize: 11, color: "#444", fontFamily: "monospace" },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    padding: 3,
  },
  toggleAllowed: {
    backgroundColor: "#00F5A030",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  toggleBlocked: {
    backgroundColor: "#FF4D4D20",
    borderWidth: 1,
    borderColor: "#FF4D4D50",
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  thumbAllowed: { backgroundColor: "#00F5A0", alignSelf: "flex-end" },
  thumbBlocked: { backgroundColor: "#FF4D4D50", alignSelf: "flex-start" },
});
