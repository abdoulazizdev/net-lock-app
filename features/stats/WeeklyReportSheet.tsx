/**
 * features/stats/WeeklyReportSheet.tsx — Bilan hebdomadaire
 *
 * Proposé une fois par semaine au lancement. Le rapport est généré à
 * l'ouverture depuis le journal natif : le stocker à l'avance obligerait à
 * planifier une tâche de fond pour un contenu consulté quelques secondes.
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { humanMinutes, plural } from "@/lib/format";
import WeeklyReportService, { type WeeklyReport } from "@/services/weekly-report.service";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  Button,
  EmptyState,
  Icon,
  Meter,
  Section,
  Sheet,
  Skeleton,
  StatBand,
  Text,
} from "@/ui";

export type WeeklyReportSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function WeeklyReportSheet({ visible, onClose }: WeeklyReportSheetProps) {
  const { t } = useTheme();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Un rapport déjà calculé s'affiche immédiatement ; sinon on le génère.
      const existing = await WeeklyReportService.getLastReport();
      const fresh = (await WeeklyReportService.generateReport()) ?? existing;
      if (!cancelled) {
        setReport(fresh);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const period = report
    ? `${new Date(report.weekStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${new Date(report.weekEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
    : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Votre semaine"
      subtitle={period}
      footer={<Button label="Terminé" onPress={onClose} fullWidth size="lg" />}
    >
      {loading ? (
        <View style={st.loading}>
          <Skeleton height={72} radius={Radius.md} />
          <Skeleton height={120} radius={Radius.md} />
        </View>
      ) : !report || report.totalBlocked + report.totalAllowed === 0 ? (
        <EmptyState
          icon="chart-timeline-variant"
          title="Pas encore de données"
          message="Activez la protection et bloquez quelques apps : votre premier bilan arrivera la semaine prochaine."
          compact
        />
      ) : (
        <>
          <StatBand
            items={[
              { value: report.totalBlocked, label: "bloquées", tone: "blocked" },
              { value: report.streakDays, label: "jours de suite", tone: "focus" },
              {
                value: humanMinutes(report.savedMinutes),
                label: "économisées",
                tone: "allowed",
              },
            ]}
          />

          <Section title="Répartition du trafic">
            <View
              style={[
                st.card,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <Meter
                segments={[
                  { value: report.totalBlocked, color: t.intent.blocked.accent, label: "Bloqué" },
                  { value: report.totalAllowed, color: t.intent.allowed.accent, label: "Autorisé" },
                ]}
                height={10}
              />
              <View style={st.legend}>
                <LegendItem
                  color={t.intent.blocked.accent}
                  label="Bloquées"
                  value={report.totalBlocked}
                />
                <LegendItem
                  color={t.intent.allowed.accent}
                  label="Autorisées"
                  value={report.totalAllowed}
                />
              </View>
            </View>
          </Section>

          {report.topApps.length > 0 ? (
            <Section title="Apps les plus bloquées">
              <View
                style={[
                  st.card,
                  { backgroundColor: t.bg.card, borderColor: t.border.light },
                ]}
              >
                {report.topApps.map((app, i) => (
                  <View key={app.packageName} style={st.topRow}>
                    <Text variant="caption" tone="faint" tabular style={st.rank}>
                      {i + 1}
                    </Text>
                    <Text variant="callout" numberOfLines={1} style={st.flex}>
                      {app.appName}
                    </Text>
                    <Text variant="footnote" tone="blocked" tabular>
                      {plural(app.blockedCount, "fois")}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {report.streakDays >= 3 ? (
            <View
              style={[
                st.praise,
                { backgroundColor: t.intent.focus.bg, borderColor: t.intent.focus.border },
              ]}
            >
              <Icon name="fire" size={20} color={t.intent.focus.accent} />
              <Text variant="callout" tone="focus" style={st.flex}>
                {report.streakDays} jours consécutifs de discipline. Continuez.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={st.legendItem}>
      <View style={[st.legendDot, { backgroundColor: color }]} />
      <Text variant="footnote" tone="muted">
        {label}
      </Text>
      <Text variant="footnote" tabular>
        {value}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  loading: { gap: Spacing.md },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  legend: { flexDirection: "row", gap: Spacing.xl },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: 5,
  },
  rank: { width: 14 },
  praise: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
