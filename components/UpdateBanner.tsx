/**
 * UpdateBanner.tsx
 * Bannière discrète affichée quand une mise à jour flexible est téléchargée.
 * À placer dans _layout.tsx ou dans la HomeScreen.
 */
import InAppUpdateService from "@/services/in-app-update.service";
import { Colors } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    // Vérifier si une mise à jour est déjà téléchargée (cas du redémarrage)
    InAppUpdateService.checkDownloadedUpdate().then((downloaded) => {
      if (downloaded) showBanner();
    });

    // Écouter le téléchargement terminé
    InAppUpdateService.onDownloaded(() => showBanner());

    // Vérifier les mises à jour disponibles (approche flexible)
    InAppUpdateService.handleUpdateIfAvailable();
  }, []);

  const showBanner = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -80,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handleInstall = async () => {
    setLoading(true);
    await InAppUpdateService.completeFlexibleUpdate();
    // L'app redémarre automatiquement après installation
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[st.banner, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={st.iconWrap}>
        <Text style={{ fontSize: 18 }}>🎉</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>Mise à jour disponible</Text>
        <Text style={st.sub}>Téléchargée et prête à installer</Text>
      </View>
      <TouchableOpacity
        style={st.btn}
        onPress={handleInstall}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={st.btnText}>{loading ? "…" : "Installer"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={hideBanner}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={st.close}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.blue[700],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 13, fontWeight: "700", color: "#fff", marginBottom: 1 },
  sub: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  btnText: { fontSize: 12, fontWeight: "800", color: Colors.blue[700] },
  close: { fontSize: 14, color: "rgba(255,255,255,0.6)", paddingLeft: 4 },
});
