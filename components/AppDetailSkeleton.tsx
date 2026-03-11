import React, { useEffect, useRef } from "react";
import { Animated, Easing, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Shimmer primitive ────────────────────────────────────────────────────────
function Bone({
  width,
  height,
  borderRadius = 8,
  opacity,
  style,
}: {
  width?: number | string;
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
          backgroundColor: "#1E1E2C",
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export default function AppDetailSkeleton() {
  const insets = useSafeAreaInsets();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.45],
  });

  return (
    <View style={[styles.container]}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {/* Back button */}
        <Bone
          width={80}
          height={14}
          borderRadius={6}
          opacity={opacity}
          style={{ marginBottom: 28 }}
        />

        {/* App hero */}
        <View style={styles.heroSection}>
          <Bone
            width={80}
            height={80}
            borderRadius={22}
            opacity={opacity}
            style={{ marginBottom: 14 }}
          />
          <Bone
            width={140}
            height={20}
            borderRadius={6}
            opacity={opacity}
            style={{ marginBottom: 8 }}
          />
          <Bone width={200} height={11} borderRadius={5} opacity={opacity} />
        </View>
      </View>

      {/* ── Body */}
      <View style={styles.body}>
        {/* Access control card */}
        <View style={styles.sectionGap}>
          <Bone
            width={120}
            height={10}
            borderRadius={4}
            opacity={opacity}
            style={{ marginBottom: 10 }}
          />
          <View style={styles.controlCard}>
            <View style={{ flex: 1, gap: 8 }}>
              <Bone
                width="55%"
                height={14}
                borderRadius={6}
                opacity={opacity}
              />
              <Bone
                width="75%"
                height={11}
                borderRadius={5}
                opacity={opacity}
              />
            </View>
            <Bone width={56} height={32} borderRadius={16} opacity={opacity} />
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.sectionGap}>
          <Bone
            width={100}
            height={10}
            borderRadius={4}
            opacity={opacity}
            style={{ marginBottom: 10 }}
          />
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statCard}>
                <Bone
                  width={40}
                  height={26}
                  borderRadius={6}
                  opacity={opacity}
                  style={{ marginBottom: 6 }}
                />
                <Bone
                  width={52}
                  height={10}
                  borderRadius={4}
                  opacity={opacity}
                />
              </View>
            ))}
          </View>
          {/* Progress bar */}
          <Bone
            height={4}
            borderRadius={2}
            opacity={opacity}
            style={{ marginTop: 4 }}
          />
          {/* Simulate button */}
          <Bone
            height={46}
            borderRadius={12}
            opacity={opacity}
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Schedule section */}
        <View style={styles.sectionGap}>
          <View style={styles.sectionHeaderRow}>
            <Bone width={110} height={10} borderRadius={4} opacity={opacity} />
            <Bone width={72} height={28} borderRadius={10} opacity={opacity} />
          </View>
          {/* Schedule card placeholder */}
          <View style={styles.scheduleCard}>
            <View style={{ flex: 1, gap: 10 }}>
              <Bone
                width="40%"
                height={12}
                borderRadius={5}
                opacity={opacity}
              />
              <Bone
                width="55%"
                height={22}
                borderRadius={6}
                opacity={opacity}
              />
              <View style={{ flexDirection: "row", gap: 5 }}>
                {[28, 28, 28, 28, 28, 28, 28].map((w, i) => (
                  <Bone
                    key={i}
                    width={w}
                    height={20}
                    borderRadius={6}
                    opacity={opacity}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 12, paddingLeft: 12, alignItems: "center" }}>
              <Bone
                width={40}
                height={22}
                borderRadius={11}
                opacity={opacity}
              />
              <Bone width={24} height={24} borderRadius={8} opacity={opacity} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  heroSection: {
    alignItems: "center",
  },

  body: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },

  sectionGap: {
    marginBottom: 26,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  controlCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    gap: 16,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    alignItems: "center",
  },

  scheduleCard: {
    flexDirection: "row",
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
});
