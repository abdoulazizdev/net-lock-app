import React, { useEffect, useRef } from "react";
import { Animated, Easing, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Single Skeleton Card ─────────────────────────────────────────────────────
function SkeletonItem({ delay = 0 }: { delay?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1100,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.icon, { opacity }]} />
      <View style={styles.info}>
        <Animated.View style={[styles.line, styles.lineLong, { opacity }]} />
        <Animated.View style={[styles.line, styles.lineShort, { opacity }]} />
      </View>
      <Animated.View style={[styles.toggle, { opacity }]} />
    </View>
  );
}

// ─── Full Skeleton Screen ─────────────────────────────────────────────────────
export default function HomeScreenSkeleton() {
  const insets = useSafeAreaInsets();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.45],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header skeleton */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Animated.View style={[styles.titleSkeleton, { opacity }]} />
            <Animated.View style={[styles.subtitleSkeleton, { opacity }]} />
          </View>
          <Animated.View style={[styles.vpnBtnSkeleton, { opacity }]} />
        </View>
        {/* Search row: input + filter toggle pill */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 0 }}>
          <Animated.View
            style={[styles.searchSkeleton, { opacity, flex: 1 }]}
          />
          <Animated.View style={[styles.filterToggleSkeleton, { opacity }]} />
        </View>
      </View>

      {/* Cards skeleton */}
      <View style={styles.list}>
        {[...Array(7)].map((_, i) => (
          <SkeletonItem key={i} delay={i * 60} />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080810",
  },

  // ── Header
  header: {
    paddingTop: 12, // overridden dynamically with insets.top
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: "#080810",
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  titleSkeleton: {
    width: 100,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#2A2A3A",
    marginBottom: 8,
  },
  subtitleSkeleton: {
    width: 150,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2A2A3A",
  },
  vpnBtnSkeleton: {
    width: 104,
    height: 36,
    borderRadius: 22,
    backgroundColor: "#2A2A3A",
  },
  searchSkeleton: {
    height: 38,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  filterToggleSkeleton: {
    width: 62,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },

  // ── List
  list: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },

  // ── Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 18,
    padding: 14,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2A2A3A",
    marginRight: 14,
  },
  info: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 10,
    borderRadius: 6,
    backgroundColor: "#2A2A3A",
  },
  lineLong: { width: "62%" },
  lineShort: { width: "38%" },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#2A2A3A",
  },
});
