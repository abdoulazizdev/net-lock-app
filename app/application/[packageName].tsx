/**
 * app/application/[packageName].tsx — Détail d'une application
 *
 * Trois volets : la règle et ses conditions, les planifications propres à
 * cette app, et la fiche système (version, permissions, actions Android).
 */

import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { fileSize, percent, plural, relativeTime } from "@/lib/format";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { ScheduleEmpty, ScheduleRow, isRunningNow } from "@/features/schedule/ScheduleRow";
import { ScheduleSheet, type ScheduleDraft } from "@/features/schedule/ScheduleSheet";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import { useSessions } from "@/features/sessions/useSessions";
import AppEvents from "@/services/app-events";
import AppInfoService, {
  isSensitivePermission,
  shortPermission,
  type AppDetails,
} from "@/services/app-info.service";
import AppListService from "@/services/app-list.service";
import ConnectionLogService from "@/services/connection-log.service";
import NetworkConditionService, {
  type NetworkCondition,
} from "@/services/network-condition.service";
import ScheduleService from "@/services/schedule.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import type { InstalledApp, Schedule } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppAvatar,
  AppBar,
  Badge,
  Button,
  Card,
  Dialog,
  Icon,
  ListGroup,
  ListRow,
  Meter,
  Screen,
  ScreenScroll,
  Section,
  Segmented,
  Skeleton,
  Switch,
  Text,
  Touchable,
  toast,
  useScrollY,
  type SegmentOption,
} from "@/ui";

type Panel = "rule" | "schedule" | "info";

const CONDITIONS: { key: NetworkCondition; label: string; hint: string; icon: "shield-off-outline" | "wifi" | "signal-cellular-3" }[] = [
  {
    key: "always",
    label: "Toujours",
    hint: "Bloquer sur toutes les connexions",
    icon: "shield-off-outline",
  },
  {
    key: "wifi_only",
    label: "Wi-Fi seulement",
    hint: "Bloquer en Wi-Fi, laisser passer en données mobiles",
    icon: "wifi",
  },
  {
    key: "mobile_only",
    label: "Données mobiles",
    hint: "Bloquer en données mobiles, laisser passer en Wi-Fi",
    icon: "signal-cellular-3",
  },
];

export default function AppDetailScreen() {
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const { t } = useTheme();
  const { scrollY, onScroll } = useScrollY();
  const sessions = useSessions();
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [panel, setPanel] = useState<Panel>("rule");
  const [app, setApp] = useState<InstalledApp | null>(null);
  const [details, setDetails] = useState<AppDetails | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [condition, setCondition] = useState<NetworkCondition>("always");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [counts, setCounts] = useState({ blocked: 0, allowed: 0, lastAttempt: 0 });
  const [loading, setLoading] = useState(true);

  const [scheduleSheet, setScheduleSheet] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [confirmDeleteSchedule, setConfirmDeleteSchedule] = useState<Schedule | null>(null);

  const load = useCallback(async () => {
    if (!packageName) return;

    const [installed, rule, cond, list, summary] = await Promise.all([
      AppListService.getAppByPackage(packageName).catch(() => null),
      StorageService.getRuleByPackage(packageName).catch(() => null),
      NetworkConditionService.getNetworkRule(packageName).catch(
        () => "always" as NetworkCondition,
      ),
      ScheduleService.getSchedules(packageName).catch(() => []),
      ConnectionLogService.getStats().catch(() => null),
    ]);

    setApp(installed);
    setBlocked(rule?.isBlocked ?? false);
    setCondition(cond);
    setSchedules(list);

    const entry = summary?.perApp.find((a) => a.packageName === packageName);
    setCounts({
      blocked: entry?.blockedCount ?? 0,
      allowed: entry?.allowedCount ?? 0,
      lastAttempt: entry?.lastAttempt ?? 0,
    });
    setLoading(false);

    // La fiche système est plus lente à obtenir : elle arrive après.
    AppInfoService.getDetails(packageName).then(setDetails);
  }, [packageName]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlocked = useCallback(async () => {
    if (sessions.locked) {
      toast.info("Session en cours — les règles sont figées.");
      return;
    }
    const next = !blocked;
    if (next) {
      const rules = await StorageService.getRules();
      const count = rules.filter((r) => r.isBlocked).length;
      if (!paywall.enforce(limits.canBlockApp(count))) return;
    }
    if (!(await guard("toggle_block_app"))) return;

    setBlocked(next);
    try {
      await VpnService.setRule(packageName!, next);
      toast.success(next ? "Application bloquée." : "Application autorisée.");
    } catch {
      setBlocked(!next);
      toast.error("La règle n'a pas pu être enregistrée.");
    }
  }, [sessions.locked, blocked, paywall, limits, guard, packageName]);

  const changeCondition = useCallback(
    async (next: NetworkCondition) => {
      setCondition(next);
      try {
        await NetworkConditionService.setNetworkRule(packageName!, next);
        AppEvents.emit("rules:changed", undefined);
      } catch {
        toast.error("La condition réseau n'a pas pu être appliquée.");
      }
    },
    [packageName],
  );

  const saveSchedule = useCallback(
    async (draft: ScheduleDraft) => {
      if (!editing && !paywall.enforce(limits.canAddSchedule(schedules.length))) return;

      const schedule: Schedule = {
        id: editing?.id ?? ScheduleService.generateId(),
        packageName: packageName!,
        label: draft.label,
        days: draft.days,
        startHour: draft.startHour,
        startMinute: draft.startMinute,
        endHour: draft.endHour,
        endMinute: draft.endMinute,
        isActive: editing?.isActive ?? true,
        action: draft.action === "allow" ? "allow" : "block",
      };

      await ScheduleService.saveSchedule(schedule);
      setSchedules(await ScheduleService.getSchedules(packageName));
      setEditing(null);
      toast.success(editing ? "Planification modifiée." : "Planification ajoutée.");
    },
    [editing, paywall, limits, schedules.length, packageName],
  );

  const openScheduleSheet = useCallback(
    (schedule?: Schedule) => {
      if (!schedule && !paywall.enforce(limits.canAddSchedule(schedules.length))) return;
      setEditing(schedule ?? null);
      setScheduleSheet(true);
    },
    [paywall, limits, schedules.length],
  );

  const deleteSchedule = useCallback(async () => {
    if (!confirmDeleteSchedule) return;
    await ScheduleService.deleteSchedule(confirmDeleteSchedule.id);
    setConfirmDeleteSchedule(null);
    setSchedules(await ScheduleService.getSchedules(packageName));
    toast.success("Planification supprimée.");
  }, [confirmDeleteSchedule, packageName]);

  const toggleSchedule = useCallback(
    async (schedule: Schedule) => {
      await ScheduleService.toggleSchedule(schedule.id);
      setSchedules(await ScheduleService.getSchedules(packageName));
    },
    [packageName],
  );

  const uninstall = useCallback(async () => {
    setConfirmUninstall(false);
    const ok = await AppInfoService.uninstall(packageName!);
    if (!ok) toast.error("La désinstallation n'a pas pu être lancée.");
  }, [packageName]);

  const totalAttempts = counts.blocked + counts.allowed;
  const appName = app?.appName ?? details?.appName ?? packageName ?? "Application";

  const panels: SegmentOption<Panel>[] = useMemo(
    () => [
      { key: "rule", label: "Règle", icon: "shield-outline" },
      { key: "schedule", label: "Horaires", icon: "calendar-clock", count: schedules.length },
      { key: "info", label: "Fiche", icon: "information-outline" },
    ],
    [schedules.length],
  );

  const sensitivePermissions = (details?.permissions ?? []).filter(isSensitivePermission);

  return (
    <Screen>
      <AppBar
        title={appName}
        subtitle={packageName}
        back
        scrollY={scrollY}
        below={
          <View style={st.tabsWrap}>
            <Segmented options={panels} value={panel} onChange={setPanel} />
          </View>
        }
      />

      <ScreenScroll onScroll={onScroll} contentContainerStyle={st.content}>
        {loading ? (
          <View style={st.loading}>
            <Skeleton height={120} radius={Radius.lg} />
            <Skeleton height={180} radius={Radius.lg} />
          </View>
        ) : (
          <>
            {/* En-tête commun aux trois volets */}
            <Card style={st.identity}>
              <AppAvatar
                packageName={packageName!}
                appName={appName}
                icon={app?.icon}
                size="lg"
              />
              <View style={st.identityText}>
                <Text variant="title3" numberOfLines={1}>
                  {appName}
                </Text>
                <Text variant="footnote" tone="faint" numberOfLines={1}>
                  {details ? `Version ${details.versionName}` : packageName}
                </Text>
                <View style={st.identityBadges}>
                  <Badge
                    label={blocked ? "Bloquée" : "Autorisée"}
                    tone={blocked ? "blocked" : "allowed"}
                  />
                  {app?.isSystemApp ? <Badge label="Système" tone="neutral" /> : null}
                  {details && !details.isEnabled ? (
                    <Badge label="Désactivée" tone="warning" />
                  ) : null}
                </View>
              </View>
            </Card>

            {panel === "rule" ? (
              <>
                <Section title="Accès au réseau">
                  <Card style={st.ruleCard}>
                    <View style={st.ruleRow}>
                      <View style={st.flex}>
                        <Text variant="headline">Bloquer internet</Text>
                        <Text variant="footnote" tone="muted">
                          {blocked
                            ? "Cette app ne peut plus atteindre le réseau."
                            : "Cette app accède normalement au réseau."}
                        </Text>
                      </View>
                      <Switch
                        value={blocked}
                        onValueChange={toggleBlocked}
                        tone="blocked"
                        disabled={sessions.locked}
                        accessibilityLabel="Bloquer internet pour cette application"
                      />
                    </View>
                  </Card>
                </Section>

                <Section
                  title="Condition"
                  footnote="Permet de ne bloquer que sur un type de connexion."
                >
                  {CONDITIONS.map((option) => {
                    const active = condition === option.key;
                    return (
                      <Touchable
                        key={option.key}
                        onPress={() => changeCondition(option.key)}
                        feedback="none"
                        disabled={!blocked}
                        style={[
                          st.condition,
                          {
                            backgroundColor: active ? t.brand.soft : t.bg.card,
                            borderColor: active ? t.brand.base : t.border.light,
                            opacity: blocked ? 1 : 0.55,
                          },
                        ]}
                      >
                        <Icon
                          name={option.icon}
                          size={18}
                          color={active ? t.brand.base : t.text.muted}
                        />
                        <View style={st.flex}>
                          <Text variant="bodyStrong">{option.label}</Text>
                          <Text variant="footnote" tone="muted">
                            {option.hint}
                          </Text>
                        </View>
                        <Icon
                          name={active ? "radiobox-marked" : "radiobox-blank"}
                          size={18}
                          color={active ? t.brand.base : t.text.faint}
                        />
                      </Touchable>
                    );
                  })}
                </Section>

                {totalAttempts > 0 ? (
                  <Section title="Tentatives observées">
                    <Card style={st.statsCard}>
                      <Meter
                        segments={[
                          {
                            value: counts.blocked,
                            color: t.intent.blocked.accent,
                            label: "Bloquées",
                          },
                          {
                            value: counts.allowed,
                            color: t.intent.allowed.accent,
                            label: "Autorisées",
                          },
                        ]}
                      />
                      <View style={st.statsRow}>
                        <View style={st.flex}>
                          <Text variant="title3" tone="blocked" tabular>
                            {counts.blocked}
                          </Text>
                          <Text variant="footnote" tone="muted">
                            bloquées ({percent(counts.blocked, totalAttempts)} %)
                          </Text>
                        </View>
                        <View style={st.flex}>
                          <Text variant="title3" tone="allowed" tabular>
                            {counts.allowed}
                          </Text>
                          <Text variant="footnote" tone="muted">
                            autorisées
                          </Text>
                        </View>
                      </View>
                      {counts.lastAttempt > 0 ? (
                        <Text variant="footnote" tone="faint">
                          Dernière tentative {relativeTime(counts.lastAttempt).toLowerCase()}
                        </Text>
                      ) : null}
                    </Card>
                  </Section>
                ) : null}
              </>
            ) : null}

            {panel === "schedule" ? (
              <Section
                title="Planifications"
                footnote="Les créneaux s'appliquent même si NetOff est fermé."
              >
                {schedules.length === 0 ? (
                  <ScheduleEmpty onAdd={() => openScheduleSheet()} />
                ) : (
                  <>
                    {schedules.map((schedule) => (
                      <ScheduleRow
                        key={schedule.id}
                        label={schedule.label}
                        days={schedule.days}
                        startHour={schedule.startHour}
                        startMinute={schedule.startMinute}
                        endHour={schedule.endHour}
                        endMinute={schedule.endMinute}
                        enabled={schedule.isActive}
                        runningNow={isRunningNow(schedule)}
                        tone={schedule.action === "block" ? "blocked" : "allowed"}
                        actionLabel={schedule.action === "block" ? "Bloquer" : "Autoriser"}
                        onToggle={() => toggleSchedule(schedule)}
                        onEdit={() => openScheduleSheet(schedule)}
                        onDelete={() => setConfirmDeleteSchedule(schedule)}
                      />
                    ))}
                    <Button
                      label="Ajouter un créneau"
                      icon="plus"
                      variant="secondary"
                      onPress={() => openScheduleSheet()}
                      fullWidth
                    />
                  </>
                )}
              </Section>
            ) : null}

            {panel === "info" ? (
              <>
                {details ? (
                  <>
                    <Section title="Informations">
                      <ListGroup inset={Spacing.lg}>
                        <ListRow title="Version" value={`${details.versionName} (${details.versionCode})`} />
                        <ListRow title="Taille de l'APK" value={fileSize(details.apkSizeBytes)} />
                        <ListRow
                          title="Installée le"
                          value={new Date(details.firstInstallTime).toLocaleDateString("fr-FR")}
                        />
                        <ListRow
                          title="Mise à jour"
                          value={new Date(details.lastUpdateTime).toLocaleDateString("fr-FR")}
                        />
                        <ListRow
                          title="Notifications"
                          value={details.notificationsEnabled ? "Autorisées" : "Bloquées"}
                        />
                        <ListRow
                          title="Type"
                          value={details.isSystemApp ? "Application système" : "Installée"}
                        />
                      </ListGroup>
                    </Section>

                    <Section
                      title={`Permissions (${details.permissions.length})`}
                      footnote={
                        sensitivePermissions.length > 0
                          ? `${plural(sensitivePermissions.length, "permission sensible", "permissions sensibles")} déclarée${sensitivePermissions.length > 1 ? "s" : ""}.`
                          : "Aucune permission sensible déclarée."
                      }
                    >
                      {details.permissions.length === 0 ? (
                        <Text variant="callout" tone="muted">
                          Cette app ne déclare aucune permission.
                        </Text>
                      ) : (
                        <View style={st.permissions}>
                          {details.permissions.map((permission) => (
                            <Badge
                              key={permission}
                              label={shortPermission(permission)}
                              tone={isSensitivePermission(permission) ? "warning" : "neutral"}
                            />
                          ))}
                        </View>
                      )}
                    </Section>

                    <Section title="Actions système">
                      <ListGroup>
                        {details.isLaunchable ? (
                          <ListRow
                            icon="open-in-new"
                            title="Ouvrir l'application"
                            trailing="chevron"
                            onPress={() => AppInfoService.launch(packageName!)}
                          />
                        ) : null}
                        <ListRow
                          icon="cog-outline"
                          title="Paramètres de l'app"
                          subtitle="Fiche système Android"
                          trailing="chevron"
                          onPress={() => AppInfoService.openSettings(packageName!)}
                        />
                        <ListRow
                          icon="bell-outline"
                          title="Notifications"
                          trailing="chevron"
                          onPress={() => AppInfoService.openNotificationSettings(packageName!)}
                        />
                        <ListRow
                          icon="folder-outline"
                          title="Stockage et cache"
                          trailing="chevron"
                          onPress={() => AppInfoService.openStorageSettings(packageName!)}
                        />
                        {!details.isSystemApp ? (
                          <ListRow
                            icon="trash-can-outline"
                            tone="danger"
                            title="Désinstaller"
                            subtitle="Android demandera confirmation"
                            trailing="chevron"
                            onPress={() => setConfirmUninstall(true)}
                          />
                        ) : null}
                      </ListGroup>
                    </Section>
                  </>
                ) : (
                  <View style={st.loading}>
                    <Skeleton height={220} radius={Radius.lg} />
                    <Text variant="footnote" tone="faint" center>
                      Lecture de la fiche système…
                    </Text>
                  </View>
                )}
              </>
            ) : null}
          </>
        )}
      </ScreenScroll>

      <ScheduleSheet
        visible={scheduleSheet}
        onClose={() => {
          setScheduleSheet(false);
          setEditing(null);
        }}
        onSave={saveSchedule}
        initial={
          editing
            ? {
                label: editing.label,
                days: editing.days,
                startHour: editing.startHour,
                startMinute: editing.startMinute,
                endHour: editing.endHour,
                endMinute: editing.endMinute,
                action: editing.action,
              }
            : undefined
        }
        actions={[
          {
            key: "block",
            label: "Bloquer",
            description: "Couper internet pendant le créneau",
            tone: "blocked",
          },
          {
            key: "allow",
            label: "Autoriser",
            description: "Laisser passer pendant le créneau",
            tone: "allowed",
          },
        ]}
      />

      <Dialog
        visible={confirmUninstall}
        onClose={() => setConfirmUninstall(false)}
        title={`Désinstaller ${appName} ?`}
        message="Android affichera sa propre confirmation. La règle de blocage associée sera conservée."
        actions={
          <>
            <Button label="Continuer" variant="danger" onPress={uninstall} fullWidth />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setConfirmUninstall(false)}
              fullWidth
            />
          </>
        }
      />

      <Dialog
        visible={confirmDeleteSchedule !== null}
        onClose={() => setConfirmDeleteSchedule(null)}
        title="Supprimer cette planification ?"
        actions={
          <>
            <Button label="Supprimer" variant="danger" onPress={deleteSchedule} fullWidth />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setConfirmDeleteSchedule(null)}
              fullWidth
            />
          </>
        }
      />

      <Paywall visible={paywall.visible} reason={paywall.reason} onClose={paywall.close} />

      <ParentalGate />
    </Screen>
  );
}

const st = StyleSheet.create({
  tabsWrap: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.md },
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.xs },
  loading: { gap: Spacing.md },
  identity: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  identityText: { flex: 1, gap: 3 },
  identityBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 2 },
  ruleCard: { paddingVertical: Spacing.lg },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  condition: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  statsCard: { gap: Spacing.md },
  statsRow: { flexDirection: "row", gap: Spacing.lg },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flex: { flex: 1 },
});
