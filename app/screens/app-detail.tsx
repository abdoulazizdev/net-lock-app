import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Divider, Switch, Text } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import VpnSimulatorService from "@/services/vpn.service";
import { AppRule, InstalledApp } from "@/types";

export default function AppDetailScreen() {
  const { packageName } = useLocalSearchParams<{ packageName: string }>();

  const [app, setApp] = useState<InstalledApp | null>(null);
  const [rule, setRule] = useState<AppRule | null>(null);
  const [stats, setStats] = useState({ blocked: 0, allowed: 0 });

  useEffect(() => {
    loadAppData();
  }, [packageName]);

  const loadAppData = async () => {
    try {
      const appData = await AppListService.getAppByPackage(packageName);
      setApp(appData);
      const existingRule = await StorageService.getRuleByPackage(packageName);
      setRule(existingRule);
      const allStats = await StorageService.getStats();
      const appStats = allStats.find((s) => s.packageName === packageName);
      if (appStats) {
        setStats({
          blocked: appStats.blockedAttempts,
          allowed: appStats.allowedAttempts,
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  const toggleBlock = async () => {
    try {
      const newBlocked = !rule?.isBlocked;
      await VpnSimulatorService.setRule(packageName, newBlocked);
      setRule((prev) => ({
        ...prev!,
        isBlocked: newBlocked,
        packageName,
        createdAt: prev?.createdAt || new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error("Erreur lors du changement de règle:", error);
    }
  };

  const simulateAttempt = async () => {
    const result =
      await VpnSimulatorService.simulateConnectionAttempt(packageName);
    await loadAppData();
    alert(
      result === "blocked" ? "🚫 Connexion bloquée" : "✅ Connexion autorisée",
    );
  };

  if (!app) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="application"
              size={48}
              color="#6200ee"
            />
            <View style={styles.headerText}>
              <Text variant="headlineSmall">{app.appName}</Text>
              <Text variant="bodySmall" style={styles.packageName}>
                {app.packageName}
              </Text>
            </View>
          </View>
          {app.isSystemApp && (
            <Chip icon="information" style={styles.systemChip}>
              Application système
            </Chip>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Contrôle d'accès Internet" />
        <Card.Content>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text variant="bodyLarge">Internet autorisé</Text>
              <Text variant="bodySmall" style={styles.hint}>
                {rule?.isBlocked
                  ? "Toutes les connexions sont bloquées"
                  : "Accès normal"}
              </Text>
            </View>
            <Switch value={!rule?.isBlocked} onValueChange={toggleBlock} />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Statistiques" />
        <Card.Content>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statValue}>
                {stats.blocked}
              </Text>
              <Text variant="bodySmall">Connexions bloquées</Text>
            </View>
            <Divider style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statValue}>
                {stats.allowed}
              </Text>
              <Text variant="bodySmall">Connexions autorisées</Text>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={simulateAttempt}
            style={styles.testButton}
            icon="test-tube"
          >
            Simuler une connexion
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Planification" />
        <Card.Content>
          <Text variant="bodyMedium" style={styles.comingSoon}>
            🚧 Fonctionnalité à venir
          </Text>
          <Text variant="bodySmall" style={styles.hint}>
            Configurez des horaires pour bloquer/autoriser automatiquement
            l'accès Internet.
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Actions rapides" />
        <Card.Content>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.actionButton}
            icon="arrow-left"
          >
            Retour à la liste
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: { margin: 16, marginBottom: 0 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  headerText: { marginLeft: 16, flex: 1 },
  packageName: { color: "#666", marginTop: 4 },
  systemChip: { marginTop: 12, alignSelf: "flex-start" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: { flex: 1 },
  hint: { color: "#666", marginTop: 4 },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontWeight: "bold" },
  statDivider: { width: 1, height: "100%" },
  testButton: { marginTop: 8 },
  comingSoon: { textAlign: "center", marginBottom: 8 },
  actionButton: { marginTop: 8 },
});
