/**
 * features/stats/StatsPanels.tsx — Vues de l'onglet Statistiques
 *
 * Quatre panneaux, un par onglet. Chacun reste un composant pur alimenté par
 * `useStats` — l'écran ne fait que choisir lequel afficher.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { clockTime, dayLabel, humanMinutes, percent, plural, relativeTime } from "@/lib/format";
import type { AppLogStats, LogEntry } from "@/services/connection-log.service";
import ProductivityService, { type Badge as BadgeModel } from "@/services/productivity.service";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppAvatar,
  Badge,
  Card,
  Divider,
  EmptyState,
  Icon,
  Meter,
  ProgressBar,
  ProgressRing,
  Section,
  StatBand,
  StatTile,
  Text,
} from "@/ui";
import type { StatsData } from "./useStats";

// ─── Vue d'ensemble ──────────────────────────────────────────────────────────

export function OverviewPanel({ stats }: { stats: StatsData }) {
  const { t } = useTheme();
  const { summary, productivity } = stats;

  if (summary.totalEvents === 0) {
    return (
      <EmptyState
        icon="chart-timeline-variant"
        title="Aucune connexion enregistrée"
        message="Activez la protection réseau et bloquez quelques apps : les tentatives de connexion apparaîtront ici."
      />
    );
  }

  const blockedPct = percent(summary.totalBlocked, summary.totalEvents);
  const topApps = [...summary.perApp]
    .sort((a, b) => b.blockedCount - a.blockedCount)
    .slice(0, 5);

  return (
    <View style={st.panel}>
      <Card style={st.hero}>
        <ProgressRing
          progress={blockedPct / 100}
          size={128}
          thickness={10}
          color={t.intent.blocked.accent}
        >
          <View style={st.ringCenter}>
            <Text variant="title1" tone="blocked" tabular>
              {blockedPct}%
            </Text>
            <Text variant="overline" tone="faint">
              filtré
            </Text>
          </View>
        </ProgressRing>

        <View style={st.heroText}>
          <Text variant="title3">Trafic intercepté</Text>
          <Text variant="callout" tone="muted">
            {plural(summary.totalBlocked, "connexion coupée", "connexions coupées")} sur{" "}
            {summary.totalEvents} observées.
          </Text>
          <Meter
            segments={[
              { value: summary.totalBlocked, color: t.intent.blocked.accent, label: "Bloqué" },
              { value: summary.totalAllowed, color: t.intent.allowed.accent, label: "Autorisé" },
            ]}
          />
        </View>
      </Card>

      <View style={st.tiles}>
        <StatTile
          icon="shield-off-outline"
          value={summary.totalBlocked}
          label="bloquées"
          tone="blocked"
        />
        <StatTile
          icon="check-network-outline"
          value={summary.totalAllowed}
          label="autorisées"
          tone="allowed"
        />
      </View>

      <View style={st.tiles}>
        <StatTile
          icon="fire"
          value={productivity?.currentStreak ?? 0}
          label="jours de suite"
          tone="focus"
          caption={
            productivity && productivity.longestStreak > 0
              ? `Record : ${plural(productivity.longestStreak, "jour")}`
              : undefined
          }
        />
        <StatTile
          icon="clock-outline"
          value={humanMinutes(productivity?.totalSavedMinutes ?? 0)}
          label="temps regagné"
          tone="brand"
          caption="Estimation"
        />
      </View>

      {topApps.length > 0 ? (
        <Section title="Apps les plus bloquées">
          <Card padded={false}>
            {topApps.map((app, i) => (
              <View key={app.packageName}>
                {i > 0 ? <Divider inset={Spacing.lg} /> : null}
                <AppStatRow app={app} name={stats.appName(app.packageName)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </View>
  );
}

// ─── Historique ──────────────────────────────────────────────────────────────

export function HistoryPanel({ stats }: { stats: StatsData }) {
  const { t } = useTheme();

  if (stats.history.length === 0) {
    return (
      <EmptyState
        icon="history"
        title="Historique vide"
        message="Les tentatives de connexion sont enregistrées pendant que la protection est active."
      />
    );
  }

  // Regroupement par jour : une liste plate de plusieurs centaines de lignes
  // horodatées est illisible.
  const groups = groupByDay(stats.history);

  return (
    <View style={st.panel}>
      {groups.map((group) => (
        <Section key={group.label} title={group.label}>
          <Card padded={false}>
            {group.entries.map((entry, i) => {
              const blocked = entry.action === "blocked";
              const intent = blocked ? t.intent.blocked : t.intent.allowed;
              return (
                <View key={`${entry.packageName}-${entry.timestamp}-${i}`}>
                  {i > 0 ? <Divider inset={Spacing.lg} /> : null}
                  <View style={st.logRow}>
                    <View
                      style={[
                        st.logDot,
                        { backgroundColor: intent.bg, borderColor: intent.border },
                      ]}
                    >
                      <Icon
                        name={blocked ? "close" : "check"}
                        size={13}
                        color={intent.accent}
                      />
                    </View>
                    <View style={st.flex}>
                      <Text variant="callout" numberOfLines={1}>
                        {stats.appName(entry.packageName)}
                      </Text>
                      <Text variant="footnote" tone="faint" numberOfLines={1}>
                        {entry.packageName}
                      </Text>
                    </View>
                    <View style={st.logMeta}>
                      <Text variant="footnote" tone="muted" tabular>
                        {clockTime(entry.timestamp)}
                      </Text>
                      <Text variant="overline" color={intent.accent}>
                        {blocked ? "Bloqué" : "Autorisé"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </Section>
      ))}
    </View>
  );
}

function groupByDay(entries: LogEntry[]): { label: string; entries: LogEntry[] }[] {
  const groups = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const label = dayLabel(entry.timestamp);
    const bucket = groups.get(label);
    if (bucket) bucket.push(entry);
    else groups.set(label, [entry]);
  }
  return [...groups.entries()].map(([label, list]) => ({ label, entries: list }));
}

// ─── Par application ─────────────────────────────────────────────────────────

export function AppsPanel({ stats }: { stats: StatsData }) {
  const apps = [...stats.summary.perApp].sort(
    (a, b) => b.blockedCount + b.allowedCount - (a.blockedCount + a.allowedCount),
  );

  if (apps.length === 0) {
    return (
      <EmptyState
        icon="apps"
        title="Aucune donnée par application"
        message="Les compteurs se remplissent dès que la protection intercepte du trafic."
      />
    );
  }

  return (
    <View style={st.panel}>
      <Card padded={false}>
        {apps.map((app, i) => (
          <View key={app.packageName}>
            {i > 0 ? <Divider inset={Spacing.lg} /> : null}
            <AppStatRow app={app} name={stats.appName(app.packageName)} detailed />
          </View>
        ))}
      </Card>
    </View>
  );
}

function AppStatRow({
  app,
  name,
  detailed = false,
}: {
  app: AppLogStats;
  name: string;
  detailed?: boolean;
}) {
  const { t } = useTheme();
  const total = app.blockedCount + app.allowedCount;
  const blockedPct = percent(app.blockedCount, total);

  return (
    <View style={st.appRow}>
      <AppAvatar packageName={app.packageName} appName={name} size="sm" />

      <View style={st.flex}>
        <View style={st.appRowHead}>
          <Text variant="callout" numberOfLines={1} style={st.flex}>
            {name}
          </Text>
          <Text variant="footnote" tone="blocked" tabular>
            {app.blockedCount}
          </Text>
        </View>

        <ProgressBar
          progress={blockedPct / 100}
          height={4}
          color={t.intent.blocked.accent}
        />

        {detailed ? (
          <View style={st.appRowMeta}>
            <Text variant="footnote" tone="faint">
              {blockedPct} % bloqué · {plural(total, "tentative")}
            </Text>
            {app.lastAttempt > 0 ? (
              <Text variant="footnote" tone="faint">
                {relativeTime(app.lastAttempt)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Productivité ────────────────────────────────────────────────────────────

export function ProductivityPanel({ stats }: { stats: StatsData }) {
  const { t } = useTheme();
  const prod = stats.productivity;

  if (!prod) {
    return (
      <EmptyState
        icon="trophy-outline"
        title="Pas encore de progression"
        message="Bloquez des apps et enchaînez les jours : votre score et vos badges apparaîtront ici."
      />
    );
  }

  const earned = prod.badges.filter((b) => b.earned);

  return (
    <View style={st.panel}>
      <Card style={st.hero}>
        <ProgressRing
          progress={prod.weeklyScore / 100}
          size={128}
          thickness={10}
          color={t.intent.focus.accent}
        >
          <View style={st.ringCenter}>
            <Text variant="title1" tone="focus" tabular>
              {prod.weeklyScore}
            </Text>
            <Text variant="overline" tone="faint">
              sur 100
            </Text>
          </View>
        </ProgressRing>

        <View style={st.heroText}>
          <Text variant="title3">Score de la semaine</Text>
          <Text variant="callout" tone="muted">
            {ProductivityService.scoreLabel(prod.weeklyScore)}
          </Text>
          <Text variant="footnote" tone="faint">
            Calculé sur les connexions bloquées, la régularité et les sessions Focus.
          </Text>
        </View>
      </Card>

      <StatBand
        items={[
          { value: prod.currentStreak, label: "jours de suite", tone: "focus" },
          { value: prod.totalFocusSessions, label: "sessions focus", tone: "brand" },
          {
            value: humanMinutes(prod.totalFocusMinutes),
            label: "en focus",
            tone: "allowed",
          },
        ]}
      />

      <View style={st.tiles}>
        <StatTile
          icon="shield-off-outline"
          value={prod.totalBlockedAllTime}
          label="blocages au total"
          tone="blocked"
        />
        <StatTile
          icon="trophy-outline"
          value={`${earned.length}/${prod.badges.length}`}
          label="badges obtenus"
          tone="warning"
        />
      </View>

      <Section title="Badges" footnote="Les badges se débloquent au fil de votre régularité.">
        <View style={st.badges}>
          {prod.badges.map((badge) => (
            <BadgeTile key={badge.id} badge={badge} />
          ))}
        </View>
      </Section>
    </View>
  );
}

function BadgeTile({ badge }: { badge: BadgeModel }) {
  const { t } = useTheme();
  return (
    <View
      style={[
        st.badgeTile,
        {
          backgroundColor: badge.earned ? t.intent.warning.bg : t.bg.cardAlt,
          borderColor: badge.earned ? t.intent.warning.border : t.border.light,
          opacity: badge.earned ? 1 : 0.6,
        },
      ]}
    >
      <Text variant="title2">{badge.icon}</Text>
      <Text variant="caption" center numberOfLines={2}>
        {badge.name}
      </Text>
      <Text variant="footnote" tone="faint" center numberOfLines={2}>
        {badge.description}
      </Text>
      {badge.earned ? <Badge label="Obtenu" tone="warning" /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  panel: { gap: Spacing.lg, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md },
  hero: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  ringCenter: { alignItems: "center" },
  heroText: { flex: 1, gap: Spacing.xs },
  tiles: { flexDirection: "row", gap: Spacing.sm },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  appRowHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  appRowMeta: { flexDirection: "row", justifyContent: "space-between" },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  logDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logMeta: { alignItems: "flex-end", gap: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  badgeTile: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
