// ─── components/ThemeToggle.tsx ───────────────────────────────────────────────
// Composant à placer dans la section Paramètres pour choisir le mode de thème.
// Affiche 3 boutons : Auto / Jour / Nuit

import { useTheme } from "@/theme";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";

type Mode = "auto" | "light" | "dark";

const OPTIONS: { key: Mode; label: string; icon: string; desc: string }[] = [
  { key: "auto", label: "Auto", icon: "◑", desc: "7h–20h" },
  { key: "light", label: "Jour", icon: "◎", desc: "Toujours" },
  { key: "dark", label: "Nuit", icon: "◉", desc: "Toujours" },
];

export default function ThemeToggle() {
  const { t, mode, setMode, isDark } = useTheme();

  return (
    <View
      style={[
        tt.wrapper,
        { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
      ]}
    >
      {OPTIONS.map((opt, i) => {
        const active = mode === opt.key;
        return (
          <React.Fragment key={opt.key}>
            <TouchableOpacity
              style={[
                tt.btn,
                active && {
                  backgroundColor: t.bg.card,
                  borderColor: t.border.focus,
                },
                !active && { borderColor: "transparent" },
              ]}
              onPress={() => setMode(opt.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  tt.icon,
                  { color: active ? t.text.link : t.text.muted },
                ]}
              >
                {opt.icon}
              </Text>
              <Text
                style={[
                  tt.label,
                  { color: active ? t.text.primary : t.text.secondary },
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  tt.desc,
                  { color: active ? t.text.muted : t.border.normal },
                ]}
              >
                {opt.desc}
              </Text>
            </TouchableOpacity>
            {i < OPTIONS.length - 1 && (
              <View style={[tt.sep, { backgroundColor: t.border.light }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const tt = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  btn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 12,
    margin: 3,
    gap: 2,
  },
  icon: { fontSize: 18, marginBottom: 2 },
  label: { fontSize: 12, fontWeight: "700" },
  desc: { fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },
  sep: { width: 1, marginVertical: 10 },
});
