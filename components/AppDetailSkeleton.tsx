import { Colors, useTheme } from "@/theme";
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
  boneColor,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  opacity: Animated.AnimatedInterpolation<number>;
  style?: object;
  boneColor: string;
}) {
  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius,
          backgroundColor: boneColor,
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
  const { t, isDark } = useTheme();
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
    outputRange: isDark ? [0.18, 0.45] : [0.3, 0.65],
  });

  // Couleur des bones adaptée au thème
  const boneColor = isDark ? Colors.dark[200] : Colors.gray[200];

  // Raccourci pour ne pas répéter boneColor partout
  const B = (
    props: Omit<React.ComponentProps<typeof Bone>, "boneColor" | "opacity">,
  ) => <Bone {...props} boneColor={boneColor} opacity={opacity} />;

  return (
    <View style={[styles.container, { backgroundColor: t.bg.page }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.bg.page} />

      {/* ── Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: t.border.light,
          },
        ]}
      >
        {/* Back button */}
        <B
          width={80}
          height={14}
          borderRadius={6}
          style={{ marginBottom: 28 }}
        />

        {/* App hero */}
        <View style={styles.heroSection}>
          <B
            width={80}
            height={80}
            borderRadius={22}
            style={{ marginBottom: 14 }}
          />
          <B
            width={140}
            height={20}
            borderRadius={6}
            style={{ marginBottom: 8 }}
          />
          <B width={200} height={11} borderRadius={5} />
        </View>
      </View>

      {/* ── Body */}
      <View style={styles.body}>
        {/* Access control card */}
        <View style={styles.sectionGap}>
          <B
            width={120}
            height={10}
            borderRadius={4}
            style={{ marginBottom: 10 }}
          />
          <View
            style={[
              styles.controlCard,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <View style={{ flex: 1, gap: 8 }}>
              <B width="55%" height={14} borderRadius={6} />
              <B width="75%" height={11} borderRadius={5} />
            </View>
            <B width={56} height={32} borderRadius={16} />
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.sectionGap}>
          <B
            width={100}
            height={10}
            borderRadius={4}
            style={{ marginBottom: 10 }}
          />
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.statCard,
                  { backgroundColor: t.bg.card, borderColor: t.border.light },
                ]}
              >
                <B
                  width={40}
                  height={26}
                  borderRadius={6}
                  style={{ marginBottom: 6 }}
                />
                <B width={52} height={10} borderRadius={4} />
              </View>
            ))}
          </View>
          {/* Progress bar */}
          <B height={4} borderRadius={2} style={{ marginTop: 4 }} />
          {/* Simulate button */}
          <B height={46} borderRadius={12} style={{ marginTop: 12 }} />
        </View>

        {/* Schedule section */}
        <View style={styles.sectionGap}>
          <View style={styles.sectionHeaderRow}>
            <B width={110} height={10} borderRadius={4} />
            <B width={72} height={28} borderRadius={10} />
          </View>
          {/* Schedule card placeholder */}
          <View
            style={[
              styles.scheduleCard,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <View style={{ flex: 1, gap: 10 }}>
              <B width="40%" height={12} borderRadius={5} />
              <B width="55%" height={22} borderRadius={6} />
              <View style={{ flexDirection: "row", gap: 5 }}>
                {[28, 28, 28, 28, 28, 28, 28].map((w, i) => (
                  <B key={i} width={w} height={20} borderRadius={6} />
                ))}
              </View>
            </View>
            <View style={{ gap: 12, paddingLeft: 12, alignItems: "center" }}>
              <B width={40} height={22} borderRadius={11} />
              <B width={24} height={24} borderRadius={8} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomWidth: 1,
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
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  scheduleCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
});
