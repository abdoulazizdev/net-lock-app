/**
 * app/profile/[profileId].tsx — Détail d'un profil
 *
 * Deux volets : les applications que le profil bloque, et ses planifications.
 * Toute modification passe par `useProfiles.save`, qui resynchronise le VPN et
 * les alarmes lorsque le profil édité est celui qui s'applique.
 */

import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import { AppFilterBar } from "@/features/apps/AppFilterBar";
import { APP_ROW_HEIGHT, AppRow } from "@/features/apps/AppRow";
import { SelectionBar } from "@/features/apps/SelectionBar";
import { useAppCatalog, type AppEntry } from "@/features/apps/useAppCatalog";
import { useAppFilter } from "@/features/apps/useAppFilter";
import { useAppSelection } from "@/features/apps/useAppSelection";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { ProfileFormSheet } from "@/features/profiles/ProfileFormSheet";
import { profileAccent, useProfiles } from "@/features/profiles/useProfiles";
import { ScheduleEmpty, ScheduleRow, isRunningNow } from "@/features/schedule/ScheduleRow";
import { ScheduleSheet, type ScheduleDraft } from "@/features/schedule/ScheduleSheet";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import type { AppRule, Profile, ProfileSchedule } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppBar,
  Badge,
  Button,
  Card,
  Dialog,
  Dot,
  EmptyState,
  Icon,
  Screen,
  Segmented,
  SkeletonList,
  Switch,
  Text,
  Touchable,
  toast,
  type SegmentOption,
} from "@/ui";

type Panel = "apps" | "schedules";

export default function ProfileDetailScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { t } = useTheme();

  const profiles = useProfiles();
  const catalog = useAppCatalog();
  const filter = useAppFilter(catalog.apps);
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [panel, setPanel] = useState<Panel>("apps");
  const [formOpen, setFormOpen] = useState(false);
  const [scheduleSheet, setScheduleSheet] = useState(false);
  const [editing, setEditing] = useState<ProfileSchedule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteSchedule, setConfirmDeleteSchedule] = useState<ProfileSchedule | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = profiles.profiles.find((p) => p.id === profileId) ?? null;
  const isActive = profiles.activeId === profileId;
  const accent = profileId ? profileAccent(profileId) : t.brand.base;

  useEffect(() => {
    if (filter.filters.scope !== "user") catalog.loadSystemApps();
  }, [filter.filters.scope, catalog]);

  /** Packages bloqués tels qu'ils sont enregistrés. */
  const storedBlocked = useMemo(
    () => new Set((profile?.rules ?? []).filter((r) => r.isBlocked).map((r) => r.packageName)),
    [profile],
  );

  /**
   * Copie locale appliquée immédiatement à l'affichage.
   *
   * Sans elle, chaque case attendait un aller-retour dans le stockage avant de
   * bouger : sur une liste où l'on coche dix applications de suite, l'écran
   * paraissait bloqué. L'écriture continue en arrière-plan, et l'on retombe
   * sur l'état enregistré dès qu'elle est terminée.
   */
  const [pendingBlocked, setPendingBlocked] = useState<Set<string> | null>(null);
  const pendingWrites = useRef(0);

  const blockedPackages = pendingBlocked ?? storedBlocked;

  // La liste affiche l'état *du profil*, pas celui des règles globales.
  const entries = useMemo<AppEntry[]>(
    () =>
      filter.results.map((app) => ({
        ...app,
        blocked: blockedPackages.has(app.packageName),
      })),
    [filter.results, blockedPackages],
  );

  const selection = useAppSelection(entries);

  // Compté sur l'état affiché, pas sur l'état enregistré : le quota doit
  // tenir compte des bascules pas encore écrites.
  const blockedCount = blockedPackages.size;
  const quotaReached = !limits.canBlockApp(blockedCount).allowed;

  const writeRules = useCallback(
    async (nextBlocked: Set<string>) => {
      if (!profile) return;

      // L'affichage passe d'abord ; le stockage suit.
      setPendingBlocked(new Set(nextBlocked));
      pendingWrites.current += 1;

      const now = new Date();
      const rules: AppRule[] = [...nextBlocked].map((packageName) => ({
        packageName,
        isBlocked: true,
        profileId: profile.id,
        createdAt: now,
        updatedAt: now,
      }));

      try {
        await profiles.save({ ...profile, rules });
      } finally {
        pendingWrites.current -= 1;
        // Seule la dernière écriture rend la main à l'état enregistré : sinon
        // une écriture lente écraserait une bascule plus récente.
        if (pendingWrites.current === 0) setPendingBlocked(null);
      }
    },
    [profile, profiles],
  );

  const toggleApp = useCallback(
    async (app: AppEntry) => {
      if (!profile) return;
      const blocking = !blockedPackages.has(app.packageName);
      if (blocking && !paywall.enforce(limits.canBlockApp(blockedCount))) return;
      if (!(await guard("change_rules"))) return;

      filter.deferResort();
      const next = new Set(blockedPackages);
      if (blocking) next.add(app.packageName);
      else next.delete(app.packageName);

      // Pas d'`await` : l'utilisateur peut enchaîner les bascules pendant que
      // l'écriture précédente se termine.
      writeRules(next).catch(() => toast.error("La règle n'a pas pu être enregistrée."));
    },
    [profile, blockedPackages, paywall, limits, blockedCount, guard, filter, writeRules],
  );

  const blockVisible = useCallback(async () => {
    if (!profile) return;
    if (!(await guard("change_rules"))) return;

    const candidates = entries.filter((a) => !a.blocked).map((a) => a.packageName);
    if (candidates.length === 0) return;

    const room = limits.maxBlockedApps - blockedCount;
    if (room <= 0) {
      paywall.open("blocked_apps");
      return;
    }

    const selected = candidates.slice(0, room);
    setBusy(true);
    try {
      await writeRules(new Set([...blockedPackages, ...selected]));
      if (selected.length < candidates.length) {
        toast.warning(
          `${plural(selected.length, "app ajoutée", "apps ajoutées")} — limite gratuite atteinte.`,
        );
        paywall.open("blocked_apps");
      } else {
        toast.success(plural(selected.length, "app bloquée", "apps bloquées"));
      }
    } finally {
      setBusy(false);
    }
  }, [profile, guard, entries, limits, blockedCount, paywall, writeRules, blockedPackages]);

  /** Applique la même règle de profil à toute la sélection, en une écriture. */
  const applyToSelection = useCallback(
    async (blocked: boolean) => {
      if (!profile) return;
      if (!(await guard("change_rules"))) return;

      const targets = entries.filter(
        (app) => selection.isSelected(app.packageName) && app.blocked !== blocked,
      );
      if (targets.length === 0) {
        selection.exit();
        return;
      }

      let packages = targets.map((app) => app.packageName);
      let truncated = false;

      if (blocked) {
        const room = limits.maxBlockedApps - blockedCount;
        if (room <= 0) {
          paywall.open("blocked_apps");
          return;
        }
        if (packages.length > room) {
          packages = packages.slice(0, room);
          truncated = true;
        }
      }

      const next = new Set(blockedPackages);
      packages.forEach((packageName) =>
        blocked ? next.add(packageName) : next.delete(packageName),
      );

      setBusy(true);
      try {
        await writeRules(next);
        selection.exit();
        if (truncated) {
          toast.warning(
            `${plural(packages.length, "app ajoutée", "apps ajoutées")} sur ${targets.length} — limite gratuite atteinte.`,
          );
          paywall.open("blocked_apps");
        } else {
          toast.success(
            blocked
              ? plural(packages.length, "app bloquée", "apps bloquées")
              : plural(packages.length, "app libérée", "apps libérées"),
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [
      profile,
      guard,
      entries,
      selection,
      limits,
      blockedCount,
      paywall,
      blockedPackages,
      writeRules,
    ],
  );

  const clearAll = useCallback(async () => {
    if (!profile) return;
    if (!(await guard("change_rules"))) return;
    setBusy(true);
    try {
      await writeRules(new Set());
      toast.success("Toutes les apps ont été libérées.");
    } finally {
      setBusy(false);
    }
  }, [profile, guard, writeRules]);

  const saveSchedule = useCallback(
    async (draft: ScheduleDraft) => {
      if (!profile) return;
      const schedules = profile.schedules ?? [];
      if (!editing && !paywall.enforce(limits.canAddSchedule(schedules.length))) return;

      const entry: ProfileSchedule = {
        id: editing?.id ?? `sch_${Date.now().toString(36)}`,
        label: draft.label,
        days: draft.days,
        startHour: draft.startHour,
        startMinute: draft.startMinute,
        endHour: draft.endHour,
        endMinute: draft.endMinute,
        isActive: editing?.isActive ?? true,
        action: draft.action === "deactivate" ? "deactivate" : "activate",
      };

      const next = editing
        ? schedules.map((s) => (s.id === editing.id ? entry : s))
        : [...schedules, entry];

      await profiles.save({ ...profile, schedules: next });
      setEditing(null);
      toast.success(editing ? "Planification modifiée." : "Planification ajoutée.");
    },
    [profile, editing, paywall, limits, profiles],
  );

  const toggleSchedule = useCallback(
    async (schedule: ProfileSchedule) => {
      if (!profile) return;
      const next = (profile.schedules ?? []).map((s) =>
        s.id === schedule.id ? { ...s, isActive: !s.isActive } : s,
      );
      await profiles.save({ ...profile, schedules: next });
    },
    [profile, profiles],
  );

  const deleteSchedule = useCallback(async () => {
    if (!profile || !confirmDeleteSchedule) return;
    const next = (profile.schedules ?? []).filter((s) => s.id !== confirmDeleteSchedule.id);
    setConfirmDeleteSchedule(null);
    await profiles.save({ ...profile, schedules: next });
    toast.success("Planification supprimée.");
  }, [profile, confirmDeleteSchedule, profiles]);

  const removeProfile = useCallback(async () => {
    if (!profile) return;
    setConfirmDelete(false);
    await profiles.remove(profile.id);
    toast.success(`Profil « ${profile.name} » supprimé.`);
    router.back();
  }, [profile, profiles]);

  const openScheduleSheet = useCallback(
    (schedule?: ProfileSchedule) => {
      const count = (profile?.schedules ?? []).length;
      if (!schedule && !paywall.enforce(limits.canAddSchedule(count))) return;
      setEditing(schedule ?? null);
      setScheduleSheet(true);
    },
    [profile, paywall, limits],
  );

  if (!profiles.loading && !profile) {
    return (
      <Screen>
        <AppBar title="Profil" back />
        <EmptyState
          icon="account-question-outline"
          title="Profil introuvable"
          message="Ce profil a peut-être été supprimé."
          actionLabel="Retour aux profils"
          onAction={() => router.replace("/profiles")}
        />
      </Screen>
    );
  }

  const panels: SegmentOption<Panel>[] = [
    { key: "apps", label: "Applications", icon: "apps", count: blockedCount },
    {
      key: "schedules",
      label: "Horaires",
      icon: "calendar-clock",
      count: (profile?.schedules ?? []).length,
    },
  ];

  const header = (
    <View style={st.header}>
      <ProfileSummary
        profile={profile}
        accent={accent}
        isActive={isActive}
        blockedCount={blockedCount}
        onToggleActive={async () => {
          if (!profile) return;
          if (!(await guard("change_rules"))) return;
          await profiles.toggleActive(profile.id);
        }}
        onRename={() => setFormOpen(true)}
        onDelete={() => setConfirmDelete(true)}
      />

      <Segmented options={panels} value={panel} onChange={setPanel} />

      {panel === "apps" ? (
        <>
          <AppFilterBar
            query={filter.query}
            onQueryChange={filter.setQuery}
            filters={filter.filters}
            onFiltersChange={filter.setFilters}
            isFiltered={filter.isFiltered}
            onReset={filter.reset}
            systemLoading={catalog.systemLoading}
          />
          <View style={st.bulk}>
            <Button
              label={selection.active ? "Quitter la sélection" : "Sélectionner"}
              icon={selection.active ? "close" : "checkbox-multiple-marked-outline"}
              variant={selection.active ? "primary" : "secondary"}
              size="sm"
              onPress={() => (selection.active ? selection.exit() : selection.enter())}
            />
            {selection.active ? null : (
              <>
                <Button
                  label="Tout bloquer"
                  icon="shield-off-outline"
                  variant="secondary"
                  size="sm"
                  onPress={blockVisible}
                  disabled={busy}
                />
                <Button
                  label="Tout libérer"
                  icon="shield-check-outline"
                  variant="ghost"
                  size="sm"
                  onPress={clearAll}
                  disabled={busy || blockedCount === 0}
                />
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <AppBar
        title={profile?.name ?? "Profil"}
        subtitle={
          profile
            ? `${plural(blockedCount, "app bloquée", "apps bloquées")}${isActive ? " · actif" : ""}`
            : undefined
        }
        back
      />

      {panel === "apps" ? (
        catalog.loading || profiles.loading ? (
          <View style={st.loadingWrap}>
            {header}
            <SkeletonList count={6} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.packageName}
            renderItem={({ item }) => (
              <AppRow
                app={item}
                onToggle={toggleApp}
                quotaReached={quotaReached}
                selectable={selection.active}
                selected={selection.isSelected(item.packageName)}
                onSelect={(app) => selection.toggle(app.packageName)}
                onLongPress={(app) => selection.enter(app.packageName)}
              />
            )}
            getItemLayout={getItemLayout}
            ListHeaderComponent={header}
            contentContainerStyle={[st.list, selection.active && st.listWithSelection]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            initialNumToRender={10}
            windowSize={9}
            ListEmptyComponent={
              <EmptyState
                icon="magnify-close"
                title="Aucune application"
                message="Modifiez la recherche ou les filtres."
                actionLabel="Réinitialiser"
                onAction={filter.reset}
                actionVariant="secondary"
                compact
              />
            }
          />
        )
      ) : (
        <FlatList
          data={profile?.schedules ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScheduleRow
              label={item.label}
              days={item.days}
              startHour={item.startHour}
              startMinute={item.startMinute}
              endHour={item.endHour}
              endMinute={item.endMinute}
              enabled={item.isActive}
              runningNow={isRunningNow(item)}
              tone={item.action === "activate" ? "blocked" : "allowed"}
              actionLabel={item.action === "activate" ? "Activer le profil" : "Désactiver"}
              onToggle={() => toggleSchedule(item)}
              onEdit={() => openScheduleSheet(item)}
              onDelete={() => setConfirmDeleteSchedule(item)}
            />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<ScheduleEmpty onAdd={() => openScheduleSheet()} />}
          ListFooterComponent={
            (profile?.schedules ?? []).length > 0 ? (
              <View style={st.footer}>
                <Button
                  label="Ajouter un créneau"
                  icon="plus"
                  variant="secondary"
                  onPress={() => openScheduleSheet()}
                  fullWidth
                />
                <Text variant="footnote" tone="faint" center>
                  Hors des créneaux d'activation, le profil ne bloque rien.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {selection.active && panel === "apps" ? (
        <SelectionBar
          count={selection.count}
          alreadyCount={selection.blockedCount}
          allSelected={selection.allVisibleSelected}
          busy={busy}
          onToggleAll={selection.toggleAllVisible}
          onBlock={() => applyToSelection(true)}
          onUnblock={() => applyToSelection(false)}
          onCancel={selection.exit}
        />
      ) : null}

      <ProfileFormSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        initial={
          profile ? { name: profile.name, description: profile.description } : undefined
        }
        onSubmit={async (name, description) => {
          if (!profile) return;
          await profiles.rename(profile.id, name, description);
          toast.success("Profil mis à jour.");
        }}
      />

      <ScheduleSheet
        visible={scheduleSheet}
        onClose={() => {
          setScheduleSheet(false);
          setEditing(null);
        }}
        onSave={saveSchedule}
        title={editing ? "Modifier le créneau" : "Nouveau créneau"}
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
            key: "activate",
            label: "Activer le profil",
            description: "Les règles du profil s'appliquent pendant le créneau",
            tone: "blocked",
          },
          {
            key: "deactivate",
            label: "Désactiver le profil",
            description: "Le profil est mis en pause pendant le créneau",
            tone: "allowed",
          },
        ]}
      />

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Supprimer « ${profile?.name ?? ""} » ?`}
        message="Ses règles et planifications seront perdues."
        actions={
          <>
            <Button label="Supprimer" variant="danger" onPress={removeProfile} fullWidth />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setConfirmDelete(false)}
              fullWidth
            />
          </>
        }
      />

      <Dialog
        visible={confirmDeleteSchedule !== null}
        onClose={() => setConfirmDeleteSchedule(null)}
        title="Supprimer ce créneau ?"
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

// ─── Résumé du profil ────────────────────────────────────────────────────────

function ProfileSummary({
  profile,
  accent,
  isActive,
  blockedCount,
  onToggleActive,
  onRename,
  onDelete,
}: {
  profile: Profile | null;
  accent: string;
  isActive: boolean;
  blockedCount: number;
  onToggleActive: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTheme();
  if (!profile) return null;

  return (
    <Card style={st.summary}>
      <View style={st.summaryHead}>
        <View style={[st.mark, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
          <Icon name="account-multiple" size={22} color={accent} />
        </View>
        <View style={st.flex}>
          <Text variant="title3" numberOfLines={1}>
            {profile.name}
          </Text>
          {profile.description ? (
            <Text variant="footnote" tone="muted" numberOfLines={2}>
              {profile.description}
            </Text>
          ) : (
            <Text variant="footnote" tone="faint">
              {plural(blockedCount, "app bloquée", "apps bloquées")}
            </Text>
          )}
        </View>
        <View style={st.summaryActions}>
          <Touchable onPress={onRename} feedback="strong" hitSlop={8}>
            <Icon name="pencil-outline" size={18} color={t.text.muted} />
          </Touchable>
          <Touchable onPress={onDelete} feedback="strong" hitSlop={8} haptic="warning">
            <Icon name="trash-can-outline" size={18} color={t.intent.danger.accent} />
          </Touchable>
        </View>
      </View>

      <View style={[st.summaryToggle, { borderTopColor: t.border.light }]}>
        {isActive ? <Dot color={accent} pulse size={8} /> : null}
        <View style={st.flex}>
          <Text variant="headline">{isActive ? "Profil actif" : "Profil inactif"}</Text>
          <Text variant="footnote" tone="faint" numberOfLines={1}>
            {isActive
              ? "Ses règles s'appliquent en ce moment"
              : "Activez-le pour appliquer ses règles"}
          </Text>
        </View>
        {blockedCount === 0 && !isActive ? (
          <Badge label="Vide" tone="warning" />
        ) : (
          <Switch
            value={isActive}
            onValueChange={onToggleActive}
            tone="allowed"
            accessibilityLabel="Activer ce profil"
          />
        )}
      </View>
    </Card>
  );
}

const ROW_STRIDE = APP_ROW_HEIGHT + Spacing.sm;
const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_STRIDE,
  offset: ROW_STRIDE * index,
  index,
});

const st = StyleSheet.create({
  header: { gap: Spacing.md, paddingBottom: Spacing.md },
  loadingWrap: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  list: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
    gap: Spacing.sm,
  },
  bulk: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  listWithSelection: { paddingBottom: 180 },
  summary: { padding: 0, gap: 0 },
  summaryHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  mark: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  summaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: { gap: Spacing.md, paddingTop: Spacing.lg },
  flex: { flex: 1 },
});
