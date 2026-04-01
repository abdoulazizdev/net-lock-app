/**
 * UpdateBanner.tsx
 * Bannière discrète affichée quand une mise à jour flexible est téléchargée.
 * Chargée en lazy depuis _layout.tsx pour ne pas bloquer le démarrage.
 * Défensive : ne crashe jamais même si InAppUpdateModule est absent.
 */
import { Colors } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeModules,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text } from "react-native-paper";

// Vérification préalable de la disponibilité du module natif
const isModuleAvailable = !!NativeModules?.InAppUpdateModule;

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isModuleAvailable) return;
    mountedRef.current = true;

    // Import dynamique pour éviter un crash si le module n'est pas disponible
    import("@/services/in-app-update.service")
      .then(({ default: InAppUpdateService }) => {
        if (!mountedRef.current) return;

        // 1. Vérifier si une mise à jour est déjà téléchargée (redémarrage app)
        InAppUpdateService.checkDownloadedUpdate()
          .then((downloaded) => {
            if (downloaded && mountedRef.current) show();
          })
          .catch(() => {});

        // 2. Écouter le téléchargement terminé
        InAppUpdateService.onDownloaded(() => {
          if (mountedRef.current) show();
        });

        // 3. Vérifier les mises à jour disponibles (non-bloquant)
        InAppUpdateService.handleUpdateIfAvailable().catch(() => {});
      })
      .catch(() => {}); // Module indisponible — ignorer silencieusement

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const show = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: -80,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (mountedRef.current) setVisible(false);
    });
  };

  const handleInstall = async () => {
    setLoading(true);
    try {
      const { default: InAppUpdateService } =
        await import("@/services/in-app-update.service");
      await InAppUpdateService.completeFlexibleUpdate();
      // L'app redémarre automatiquement
    } catch {
      setLoading(false);
    }
  };

  // Ne rien rendre si module absent ou bannière cachée
  if (!isModuleAvailable || !visible) return null;

  return (
    <Animated.View
      style={[st.banner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={{ fontSize: 18 }}>🎉</Text>
      <Text style={st.title} numberOfLines={1}>
        Mise à jour prête ·{" "}
        <Text style={st.sub}>Nouvelle version disponible</Text>
      </Text>
      <TouchableOpacity
        style={st.btn}
        onPress={handleInstall}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={st.btnText}>{loading ? "…" : "Installer"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={hide}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
    paddingVertical: 14,
    backgroundColor: Colors.blue[700],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  title: { flex: 1, fontSize: 12, fontWeight: "700", color: "#fff" },
  sub: { fontWeight: "400", color: "rgba(255,255,255,0.75)" },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  btnText: { fontSize: 12, fontWeight: "800", color: Colors.blue[700] },
  close: { fontSize: 14, color: "rgba(255,255,255,0.55)" },
});

export default UpdateBanner;
