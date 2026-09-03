/**
 * app/settings/data.tsx — Sauvegarde et données
 *
 * Export/import des règles et profils, et remise à zéro. L'effacement est la
 * seule action irréversible de l'app : elle demande une confirmation écrite,
 * pas un simple « OK ».
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import AppEvents from "@/services/app-events";
import ConnectionLogService from "@/services/connection-log.service";
import ImportExportService from "@/services/import-export.service";
import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { Spacing, useTheme } from "@/theme";
import {
  AppBar,
  Button,
  Card,
  Dialog,
  Icon,
  ListGroup,
  ListRow,
  Screen,
  ScreenScroll,
  Section,
  StatBand,
  Text,
  TextField,
  toast,
} from "@/ui";

/** Mot à saisir pour confirmer l'effacement complet. */
const ERASE_KEYWORD = "EFFACER";

export default function DataSettingsScreen() {
  const { t } = useTheme();
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [counts, setCounts] = useState({ rules: 0, profiles: 0, events: 0 });
  const [busy, setBusy] = useState<"export" | "import" | "erase" | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace" | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseInput, setEraseInput] = useState("");

  const load = useCallback(async () => {
    const [rules, profiles, logs] = await Promise.all([
      StorageService.getRules().catch(() => []),
      StorageService.getProfiles().catch(() => []),
      ConnectionLogService.getStats().catch(() => null),
    ]);
    setCounts({
      rules: rules.filter((r) => r.isBlocked).length,
      profiles: profiles.length,
      events: logs?.totalEvents ?? 0,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportData = useCallback(async () => {
    if (!paywall.enforce(limits.canExportImport())) return;
    setBusy("export");
    try {
      await ImportExportService.exportRules();
    } catch {
      toast.error("L'export a échoué.");
    } finally {
      setBusy(null);
    }
  }, [paywall, limits]);

  const runImport = useCallback(
    async (mode: "merge" | "replace") => {
      setImportMode(null);
      if (!paywall.enforce(limits.canExportImport())) return;
      if (!(await guard("change_rules"))) return;

      setBusy("import");
      try {
        const result = await ImportExportService.importRules(mode);
        await VpnService.syncRules();
        AppEvents.emit("rules:changed", undefined);
        AppEvents.emit("profile:changed", undefined);
        await load();
        toast.success(
          `${plural(result.rules, "règle importée", "règles importées")} · ${plural(result.profiles, "profil", "profils")}.`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "L'import a échoué.";
        if (message !== "Import annulé.") toast.error(message);
      } finally {
        setBusy(null);
      }
    },
    [paywall, limits, guard, load],
  );

  const erase = useCallback(async () => {
    if (eraseInput.trim().toUpperCase() !== ERASE_KEYWORD) {
      toast.error(`Saisissez « ${ERASE_KEYWORD} » pour confirmer.`);
      return;
    }
    if (!(await guard("change_rules"))) return;

    setBusy("erase");
    try {
      // Ordre important : désactiver le profil actif libère aussi les alarmes
      // et le VPN avant de supprimer les données qu'ils référencent.
      await ProfileService.deactivateProfile();
      await StorageService.clearRules();
      await StorageService.clearProfiles();
      await StorageService.clearStats();
      await ConnectionLogService.clearLogs();
      await VpnService.stopVpn();

      AppEvents.emit("rules:changed", undefined);
      AppEvents.emit("profile:changed", undefined);
      AppEvents.emit("stats:refresh", undefined);

      setEraseOpen(false);
      setEraseInput("");
      await load();
      toast.success("Toutes les données ont été effacées.");
    } catch {
      toast.error("L'effacement a échoué.");
    } finally {
      setBusy(null);
    }
  }, [eraseInput, guard, load]);

  return (
    <Screen>
      <AppBar title="Données" back />

      <ScreenScroll contentContainerStyle={st.content}>
        <StatBand
          items={[
            { value: counts.rules, label: "règles", tone: "blocked" },
            { value: counts.profiles, label: "profils", tone: "brand" },
            { value: counts.events, label: "événements", tone: "info" },
          ]}
        />

        <Section
          title="Sauvegarde"
          footnote="Le fichier exporté contient vos règles et profils, sans donnée personnelle."
        >
          <ListGroup>
            <ListRow
              icon="tray-arrow-up"
              tone="brand"
              title="Exporter"
              subtitle="Partager un fichier JSON de vos réglages"
              locked={!limits.canExportImport().allowed}
              trailing="chevron"
              onPress={exportData}
              disabled={busy !== null}
            />
            <ListRow
              icon="tray-arrow-down"
              tone="brand"
              title="Importer"
              subtitle="Restaurer depuis un fichier exporté"
              locked={!limits.canExportImport().allowed}
              trailing="chevron"
              onPress={() => setImportMode("merge")}
              disabled={busy !== null}
            />
          </ListGroup>
        </Section>

        <Section title="Effacement">
          <Card
            style={[
              st.danger,
              { backgroundColor: t.intent.danger.bg, borderColor: t.intent.danger.border },
            ]}
          >
            <View style={st.dangerHead}>
              <Icon name="alert-octagon-outline" size={20} color={t.intent.danger.accent} />
              <Text variant="headline" tone="danger">
                Effacer toutes les données
              </Text>
            </View>
            <Text variant="footnote" tone="muted">
              Supprime les règles, les profils, les planifications et
              l'historique. Le verrouillage et l'abonnement ne sont pas touchés.
              Cette action est définitive.
            </Text>
            <Button
              label="Effacer les données"
              variant="danger"
              onPress={() => setEraseOpen(true)}
              disabled={busy !== null}
              fullWidth
            />
          </Card>
        </Section>
      </ScreenScroll>

      {/* Choix du mode d'import */}
      <Dialog
        visible={importMode !== null}
        onClose={() => setImportMode(null)}
        title="Comment importer ?"
        message="Fusionner ajoute les règles du fichier aux vôtres. Remplacer efface d'abord les règles existantes."
        actions={
          <>
            <Button
              label="Fusionner"
              icon="call-merge"
              onPress={() => runImport("merge")}
              fullWidth
            />
            <Button
              label="Remplacer"
              icon="file-replace-outline"
              variant="secondary"
              onPress={() => runImport("replace")}
              fullWidth
            />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setImportMode(null)}
              fullWidth
            />
          </>
        }
      />

      {/* Confirmation d'effacement */}
      <Dialog
        visible={eraseOpen}
        onClose={() => {
          setEraseOpen(false);
          setEraseInput("");
        }}
        title="Effacer définitivement ?"
        message={`Saisissez « ${ERASE_KEYWORD} » pour confirmer.`}
        actions={
          <>
            <Button
              label="Effacer tout"
              variant="danger"
              onPress={erase}
              loading={busy === "erase"}
              disabled={eraseInput.trim().toUpperCase() !== ERASE_KEYWORD}
              fullWidth
            />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => {
                setEraseOpen(false);
                setEraseInput("");
              }}
              fullWidth
            />
          </>
        }
      >
        <TextField
          value={eraseInput}
          onChangeText={setEraseInput}
          placeholder={ERASE_KEYWORD}
          autoCapitalize="characters"
          autoCorrect={false}
          icon="keyboard-outline"
        />
      </Dialog>

      <Paywall visible={paywall.visible} reason={paywall.reason} onClose={paywall.close} />

      <ParentalGate />
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  danger: { gap: Spacing.md },
  dangerHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
});
