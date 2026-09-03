/**
 * features/profiles/useProfiles.ts — Gestion des profils
 *
 * Un profil est un jeu de règles nommé, éventuellement planifié. Activer un
 * profil remplace les règles courantes et programme ses alarmes ; c'est
 * `ProfileService` qui garantit la cohérence entre stockage, VPN et
 * AlarmManager — ce hook ne fait que l'appeler et rafraîchir l'affichage.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import AppEvents from "@/services/app-events";
import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import type { Profile } from "@/types";

export type ProfilesState = {
  profiles: Profile[];
  activeId: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  create: (name: string, description?: string) => Promise<Profile>;
  rename: (profileId: string, name: string, description?: string) => Promise<void>;
  remove: (profileId: string) => Promise<void>;
  /** Active le profil, ou le désactive s'il l'est déjà. */
  toggleActive: (profileId: string) => Promise<void>;
  /** Persiste un profil modifié et resynchronise s'il est actif. */
  save: (profile: Profile) => Promise<void>;
};

function newProfileId(): string {
  return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useProfiles(): ProfilesState {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const [list, active] = await Promise.all([
      StorageService.getProfiles().catch(() => []),
      StorageService.getActiveProfile().catch(() => null),
    ]);
    if (!mounted.current) return;
    setProfiles(list);
    setActiveId(active?.id ?? null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load]);

  const create = useCallback(
    async (name: string, description?: string) => {
      const profile: Profile = {
        id: newProfileId(),
        name: name.trim(),
        description: description?.trim() || undefined,
        isActive: false,
        rules: [],
        schedules: [],
        createdAt: new Date(),
      };
      await StorageService.saveProfile(profile);
      await load();
      AppEvents.emit("profile:changed", undefined);
      return profile;
    },
    [load],
  );

  const save = useCallback(
    async (profile: Profile) => {
      await StorageService.saveProfile(profile);
      // Si c'est le profil actif, ses règles et alarmes doivent suivre.
      await ProfileService.onProfileChanged(profile);
      await load();
      AppEvents.emit("profile:changed", undefined);
      AppEvents.emit("rules:changed", undefined);
    },
    [load],
  );

  const rename = useCallback(
    async (profileId: string, name: string, description?: string) => {
      const list = await StorageService.getProfiles();
      const profile = list.find((p) => p.id === profileId);
      if (!profile) return;
      await save({
        ...profile,
        name: name.trim(),
        description: description?.trim() || undefined,
      });
    },
    [save],
  );

  const remove = useCallback(
    async (profileId: string) => {
      // Un profil actif doit d'abord être désactivé, sinon ses règles et ses
      // alarmes survivraient à sa suppression.
      if (activeId === profileId) await ProfileService.deactivateProfile();
      await StorageService.deleteProfile(profileId);
      await load();
      AppEvents.emit("profile:changed", undefined);
      AppEvents.emit("rules:changed", undefined);
    },
    [activeId, load],
  );

  const toggleActive = useCallback(
    async (profileId: string) => {
      if (activeId === profileId) await ProfileService.deactivateProfile();
      else await ProfileService.activateProfile(profileId);
      await load();
      AppEvents.emit("profile:changed", undefined);
      AppEvents.emit("rules:changed", undefined);
    },
    [activeId, load],
  );

  useEffect(() => {
    load();
    const unsub = AppEvents.on("profile:changed", () => load());
    return () => unsub();
  }, [load]);

  return {
    profiles,
    activeId,
    loading,
    refreshing,
    refresh,
    create,
    rename,
    remove,
    toggleActive,
    save,
  };
}

// ─── Habillage ───────────────────────────────────────────────────────────────

/** Palette d'accents attribuée aux profils, dans l'ordre de création. */
const PROFILE_ACCENTS = [
  "#5261F5",
  "#8257EC",
  "#17A268",
  "#EFA315",
  "#DE3F3D",
  "#1FB4CE",
  "#E2559C",
  "#4B7BEC",
];

/** Couleur stable dérivée de l'identifiant — reconnaissable d'un lancement à l'autre. */
export function profileAccent(profileId: string): string {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = (hash * 33 + profileId.charCodeAt(i)) % 9973;
  }
  return PROFILE_ACCENTS[hash % PROFILE_ACCENTS.length];
}

/** Compte les règles de blocage d'un profil. */
export function blockedInProfile(profile: Profile): number {
  return (profile.rules ?? []).filter((r) => r.isBlocked).length;
}

/** Compte les planifications actives d'un profil. */
export function activeSchedules(profile: Profile): number {
  return (profile.schedules ?? []).filter((s) => s.isActive).length;
}
