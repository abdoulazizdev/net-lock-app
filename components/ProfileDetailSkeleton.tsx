import React, { useEffect, useRef } from "react";
import { Animated, Easing, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Primitive ────────────────────────────────────────────────────────────────
function Bone({
  width,
  height,
  borderRadius = 7,
  opacity,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  opacity: Animated.AnimatedInterpolation<number>;
  style?: object;
}) {
  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius,
          backgroundColor: "#1C1C2C",
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Single app-row skeleton ──────────────────────────────────────────────────
function AppRowBone({
  opacity,
}: {
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Animated.View style={[sk.appRow, { opacity }]}>
      {/* icon */}
      <View style={sk.appIcon} />
      {/* name + package */}
      <View style={sk.appInfo}>
        <View style={[sk.appLine, { width: "52%" }]} />
        <View style={[sk.appLine, { width: "70%", marginTop: 6 }]} />
      </View>
      {/* toggle */}
      <View style={sk.appToggle} />
    </Animated.View>
  );
}

// ─── Main skeleton ────────────────────────────────────────────────────────────
export default function ProfileDetailSkeleton({
  skeletonOnly = false,
}: {
  /** When true, renders only the body (search + rows) without the full-screen header.
   *  Used inline in ProfileDetailScreen while apps load after profile is already visible. */
  skeletonOnly?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.42],
  });

  // staggered opacity for app rows
  const rowOpacities = Array.from({ length: 10 }, (_, i) => {
    const offset = i * 0.06;
    return shimmer.interpolate({
      inputRange: [0, Math.min(offset + 0.5, 1), 1],
      outputRange: [0.1, 0.38, 0.1],
      extrapolate: "clamp",
    });
  });

  if (skeletonOnly) {
    return (
      <View style={{ paddingHorizontal: 0, paddingTop: 4 }}>
        <View style={styles.searchBar}>
          <Bone
            width={14}
            height={14}
            borderRadius={4}
            opacity={opacity}
            style={{ marginRight: 10 }}
          />
          <Bone width="70%" height={13} borderRadius={5} opacity={opacity} />
        </View>
        <View style={styles.bulkRow}>
          <View style={styles.bulkBtn}>
            <Bone width={6} height={6} borderRadius={3} opacity={opacity} />
            <Bone width={80} height={12} borderRadius={5} opacity={opacity} />
          </View>
          <View style={styles.bulkBtn}>
            <Bone width={6} height={6} borderRadius={3} opacity={opacity} />
            <Bone width={80} height={12} borderRadius={5} opacity={opacity} />
          </View>
        </View>
        {rowOpacities.map((rowOpacity, i) => (
          <AppRowBone key={i} opacity={rowOpacity} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Back button */}
        <View style={styles.backRow}>
          <Bone width={10} height={14} borderRadius={3} opacity={opacity} />
          <Bone width={52} height={12} borderRadius={5} opacity={opacity} />
        </View>

        {/* Profile hero row */}
        <View style={styles.heroRow}>
          {/* Avatar */}
          <Bone width={48} height={48} borderRadius={14} opacity={opacity} />

          {/* Name + meta */}
          <View style={styles.heroInfo}>
            <Bone width="55%" height={18} borderRadius={6} opacity={opacity} />
            <Bone
              width="75%"
              height={11}
              borderRadius={4}
              opacity={opacity}
              style={{ marginTop: 7 }}
            />
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {/* Active pill */}
          <View style={styles.tabActivePill} />
          {/* Tab labels */}
          <View style={styles.tab}>
            <Bone width={90} height={11} borderRadius={5} opacity={opacity} />
          </View>
          <View style={styles.tab}>
            <Bone width={100} height={11} borderRadius={5} opacity={opacity} />
          </View>
        </View>
      </View>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Bone
            width={14}
            height={14}
            borderRadius={4}
            opacity={opacity}
            style={{ marginRight: 10 }}
          />
          <Bone width="70%" height={13} borderRadius={5} opacity={opacity} />
        </View>

        {/* Bulk action buttons */}
        <View style={styles.bulkRow}>
          <View style={styles.bulkBtn}>
            <Bone width={6} height={6} borderRadius={3} opacity={opacity} />
            <Bone width={80} height={12} borderRadius={5} opacity={opacity} />
          </View>
          <View style={styles.bulkBtn}>
            <Bone width={6} height={6} borderRadius={3} opacity={opacity} />
            <Bone width={80} height={12} borderRadius={5} opacity={opacity} />
          </View>
        </View>

        {/* App rows */}
        {rowOpacities.map((rowOpacity, i) => (
          <AppRowBone key={i} opacity={rowOpacity} />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  // Header (mirrors detail.header exactly)
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  heroInfo: { flex: 1, gap: 0 },

  // Tab bar (mirrors detail.tabBar)
  tabBar: {
    flexDirection: "row",
    height: 44,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    position: "relative",
  },
  tabActivePill: {
    position: "absolute",
    left: 0,
    width: "50%",
    height: "100%",
    backgroundColor: "#16103A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 14 },

  // Search bar (mirrors detail.searchBar minus margin)
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 10,
  },

  // Bulk buttons (mirrors detail.bulkRow / detail.bulkBtn)
  bulkRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  bulkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
    backgroundColor: "#0E0E18",
    borderColor: "#1C1C2C",
  },
});

// App row skeleton styles (mirrors ar.container exactly)
const sk = StyleSheet.create({
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    height: 68,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: "#1C1C2C",
    marginRight: 14,
  },
  appInfo: { flex: 1 },
  appLine: {
    height: 11,
    borderRadius: 4,
    backgroundColor: "#1C1C2C",
  },
  appToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1C1C2C",
  },
});
