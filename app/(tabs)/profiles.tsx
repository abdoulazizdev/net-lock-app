/**
 * app/(tabs)/profiles.tsx — Profils
 *
 * Liste des jeux de règles enregistrés. Un seul profil peut être actif : c'est
 * lui qui décide des règles appliquées et des alarmes programmées.
 */

import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { ProfileCard } from "@/features/profiles/ProfileCard";
import { ProfileFormSheet } from "@/features/profiles/ProfileFormSheet";
import { TemplateSheet } from "@/features/profiles/TemplateSheet";
import { useProfiles } from "@/features/profiles/useProfiles";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import { useSessions } from "@/features/sessions/useSessions";
import type { Profile } from "@/types";
import { Radius, Spacing, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import {
  AppBar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Icon,
  Screen,
  SkeletonCard,
  Text,
  Touchable,
  toast,
} from "@/ui";

export default function ProfilesScreen() {
  const { t } = useTheme();
  const profiles = useProfiles();
  const sessions = useSessions();
  const { isPremium, limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [formOpen, setFormOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const startCreate = useCallback(() => {
    if (!paywall.enforce(limits.canCreateProfile(profiles.profiles.length))) return;
    setFormOpen(true);
  }, [paywall, limits, profiles.profiles.length]);

  const startTemplates = useCallback(() => {
    if (!paywall.enforce(limits.canCreateProfile(profiles.profiles.length))) return;
    setTemplatesOpen(true);
  }, [paywall, limits, profiles.profiles.length]);

  const openProfile = useCallback((profile: Profile) => {
    router.push({
      pathname: "/profile/[profileId]",
      params: { profileId: profile.id },
    });
  }, []);

  const toggleActive = useCallback(
    async (profile: Profile) => {
      if (sessions.locked) {
        toast.info("Session en cours — les profils sont figés.");
        return;
      }
      if (!(await guard("change_rules"))) return;

      setBusyId(profile.id);
      try {
        const wasActive = profiles.activeId === profile.id;
        await profiles.toggleActive(profile.id);
        toast.success(
          wasActive
            ? `Profil « ${profile.name} » désactivé.`
            : `Profil « ${profile.name} » activé.`,
        );
      } catch {
        toast.error("Le profil n'a pas pu être activé.");
      } finally {
        setBusyId(null);
      }
    },
    [sessions.locked, guard, profiles],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    setPendingDelete(null);
    try {
      await profiles.remove(pendingDelete.id);
      toast.success(`Profil « ${name} » supprimé.`);
    } catch {
      toast.error("La suppression a échoué.");
    }
  }, [pendingDelete, profiles]);

  const atQuota = !limits.canCreateProfile(profiles.profiles.length).allowed;

  return (
    <Screen>
      <AppBar
        title="Profils"
        subtitle={
          profiles.profiles.length === 0
            ? "Aucun profil"
            : `${plural(profiles.profiles.length, "profil", "profils")}${profiles.activeId ? " · 1 actif" : ""}`
        }
        right={
          <View style={st.actions}>
            <Button
              label="Modèles"
              icon="shape-outline"
              variant="secondary"
              size="sm"
              onPress={startTemplates}
            />
            <Button label="Nouveau" icon="plus" size="sm" onPress={startCreate} />
          </View>
        }
      />

      {profiles.loading ? (
        <View style={st.loading}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : (
        <FlatList
          data={profiles.profiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProfileCard
              profile={item}
              active={profiles.activeId === item.id}
              busy={busyId === item.id}
              onPress={() => openProfile(item)}
              onToggle={() => toggleActive(item)}
            />
          )}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={profiles.refreshing}
              onRefresh={profiles.refresh}
              tintColor={t.refreshTint}
              colors={[t.refreshTint]}
              progressBackgroundColor={t.bg.card}
            />
          }
          ListHeaderComponent={
            atQuota ? (
              <Touchable
                onPress={() => paywall.open("profiles")}
                feedback="subtle"
                style={[
                  st.quota,
                  {
                    backgroundColor: t.intent.warning.bg,
                    borderColor: t.intent.warning.border,
                  },
                ]}
              >
                <Icon name="lock-outline" size={18} color={t.intent.warning.accent} />
                <Text variant="footnote" tone="warning" style={st.flex}>
                  Version gratuite : {plural(limits.maxProfiles, "profil", "profils")} maximum.
                </Text>
                <Badge label="Passer Pro" tone="focus" />
              </Touchable>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-multiple-plus-outline"
              title="Aucun profil"
              message="Un profil regroupe des règles que vous activez d'un geste : mode travail, sommeil, détox… Partez d'un modèle pour aller plus vite."
              actionLabel="Choisir un modèle"
              onAction={startTemplates}
              secondaryLabel="Créer un profil vide"
              onSecondary={startCreate}
            />
          }
          ListFooterComponent={
            profiles.profiles.length > 0 ? (
              <Text variant="footnote" tone="faint" center style={st.hint}>
                Appuyez sur un profil pour choisir ses apps et ses horaires.
              </Text>
            ) : null
          }
        />
      )}

      <ProfileFormSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (name, description) => {
          const profile = await profiles.create(name, description);
          toast.success(`Profil « ${name} » créé.`);
          openProfile(profile);
        }}
      />

      <TemplateSheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        isPremium={isPremium}
        onCreated={(profile) => {
          profiles.refresh();
          openProfile(profile);
        }}
        onQuotaExceeded={() => paywall.open("blocked_apps")}
      />

      <Dialog
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={`Supprimer « ${pendingDelete?.name ?? ""} » ?`}
        message="Les règles et planifications de ce profil seront perdues. Les apps actuellement bloquées seront libérées si le profil est actif."
        actions={
          <>
            <Button label="Supprimer" variant="danger" onPress={confirmDelete} fullWidth />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setPendingDelete(null)}
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
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  loading: { gap: Spacing.md, paddingHorizontal: Spacing.gutter },
  list: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    paddingBottom: TAB_BAR_HEIGHT + Spacing.huge,
    gap: Spacing.md,
  },
  quota: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  hint: { paddingTop: Spacing.lg },
  flex: { flex: 1 },
});
