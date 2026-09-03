/**
 * features/profiles/TemplateSheet.tsx — Profils prêts à l'emploi
 *
 * Créer un profil depuis zéro suppose de connaître les packages à bloquer.
 * Les modèles font le rapprochement automatiquement avec ce qui est installé
 * sur l'appareil, et indiquent combien d'apps ils vont réellement toucher.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import ProfileTemplatesService, {
  TEMPLATES,
  type ProfileTemplate,
} from "@/services/profile-templates.service";
import type { Profile } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
import { Badge, Icon, Sheet, Skeleton, Text, Touchable, toast } from "@/ui";

export type TemplateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (profile: Profile) => void;
  isPremium: boolean;
  /** Ouvre le paywall lorsque le modèle dépasse le quota gratuit. */
  onQuotaExceeded: () => void;
};

export function TemplateSheet({
  visible,
  onClose,
  onCreated,
  isPremium,
  onQuotaExceeded,
}: TemplateSheetProps) {
  const { t } = useTheme();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  // Le décompte lit l'inventaire des apps : une seule fois, à l'ouverture, et
  // pour tous les modèles à la fois.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCounts(null);
    ProfileTemplatesService.countInstalled(TEMPLATES)
      .then((result) => {
        if (!cancelled) setCounts(result);
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const create = useCallback(
    async (template: ProfileTemplate) => {
      setCreating(template.id);
      try {
        const result = await ProfileTemplatesService.createFromTemplate(template, isPremium);
        onCreated(result.profile);
        onClose();

        if (result.wasTruncated) {
          toast.warning(
            `${plural(result.blockedCount, "app bloquée", "apps bloquées")} sur ${result.detectedCount} détectées — limite gratuite atteinte.`,
          );
          onQuotaExceeded();
        } else {
          toast.success(
            `Profil « ${template.name} » créé — ${plural(result.blockedCount, "app bloquée", "apps bloquées")}.`,
          );
        }
      } catch {
        toast.error("La création du profil a échoué.");
      } finally {
        setCreating(null);
      }
    },
    [isPremium, onClose, onCreated, onQuotaExceeded],
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Modèles de profil"
      subtitle="NetOff repère les apps concernées parmi celles installées et prépare les règles."
    >
      {TEMPLATES.map((template) => {
        const installed = counts?.[template.id];
        const busy = creating === template.id;

        return (
          <Touchable
            key={template.id}
            onPress={() => create(template)}
            disabled={creating !== null}
            feedback="subtle"
            style={[
              st.row,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <View
              style={[
                st.icon,
                { backgroundColor: `${template.color}1F`, borderColor: `${template.color}55` },
              ]}
            >
              <Text variant="title3">{template.icon}</Text>
            </View>

            <View style={st.text}>
              <Text variant="headline" numberOfLines={1}>
                {template.name}
              </Text>
              <Text variant="footnote" tone="muted" numberOfLines={2}>
                {template.description}
              </Text>
              {counts === null ? (
                <Skeleton width={90} height={9} />
              ) : (
                <Text
                  variant="caption"
                  tone={installed && installed > 0 ? "allowed" : "faint"}
                >
                  {installed && installed > 0
                    ? `${plural(installed, "app détectée", "apps détectées")} sur cet appareil`
                    : "Aucune app correspondante installée"}
                </Text>
              )}
            </View>

            {busy ? (
              <Badge label="Création…" tone="brand" />
            ) : (
              <Icon name="plus-circle-outline" size={22} color={t.brand.base} />
            )}
          </Touchable>
        );
      })}
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
