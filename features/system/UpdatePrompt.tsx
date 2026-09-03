/**
 * features/system/UpdatePrompt.tsx — Mises à jour Google Play
 *
 * Discret par défaut : rien ne s'affiche si aucune mise à jour n'est
 * disponible. Une mise à jour critique est proposée en plein écran par Play
 * lui-même ; les autres se téléchargent en fond et ne se signalent qu'une fois
 * prêtes à être installées.
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import InAppUpdateService, { type UpdateProgress } from "@/services/in-app-update.service";
import { Radius, Spacing, useTheme } from "@/theme";
import { Button, Icon, ProgressBar, Text, Touchable } from "@/ui";

export function UpdatePrompt({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Une mise à jour peut déjà être téléchargée depuis une session passée.
    InAppUpdateService.checkDownloadedUpdate()
      .then((pending) => {
        if (pending && !cancelled) setDownloaded(true);
      })
      .catch(() => {});

    InAppUpdateService.handleUpdateIfAvailable().catch(() => {});

    const offProgress = InAppUpdateService.onProgress(setProgress);
    const offDownloaded = InAppUpdateService.onDownloaded(() => {
      setProgress(null);
      setDownloaded(true);
    });

    return () => {
      cancelled = true;
      offProgress();
      offDownloaded();
    };
  }, []);

  if (dismissed) return null;

  const isDownloading =
    !downloaded && progress !== null && progress.status === "downloading";

  if (!downloaded && !isDownloading) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      style={[
        st.host,
        { bottom: insets.bottom + bottomOffset + Spacing.lg },
      ]}
    >
      <View
        style={[
          st.card,
          { backgroundColor: t.bg.elevated, borderColor: t.border.normal },
          t.shadow.lg,
        ]}
      >
        <View
          style={[
            st.iconBox,
            { backgroundColor: t.brand.soft, borderColor: t.brand.softBorder },
          ]}
        >
          <Icon name="cloud-download-outline" size={19} color={t.brand.base} />
        </View>

        <View style={st.body}>
          {isDownloading ? (
            <>
              <Text variant="headline" numberOfLines={1}>
                Téléchargement de la mise à jour
              </Text>
              <ProgressBar
                progress={(progress?.percentComplete ?? 0) / 100}
                height={4}
              />
            </>
          ) : (
            <>
              <Text variant="headline" numberOfLines={1}>
                Mise à jour prête
              </Text>
              <Text variant="footnote" tone="muted" numberOfLines={1}>
                NetOff redémarrera pour l'installer.
              </Text>
            </>
          )}
        </View>

        {isDownloading ? null : (
          <Button
            label="Installer"
            size="sm"
            loading={installing}
            onPress={() => {
              setInstalling(true);
              InAppUpdateService.completeFlexibleUpdate().catch(() => setInstalling(false));
            }}
          />
        )}

        <Touchable
          onPress={() => setDismissed(true)}
          feedback="none"
          hitSlop={10}
          accessibilityLabel="Ignorer"
        >
          <Icon name="close" size={15} color={t.text.muted} />
        </Touchable>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  host: {
    position: "absolute",
    left: Spacing.gutter,
    right: Spacing.gutter,
    zIndex: 900,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 4 },
});
