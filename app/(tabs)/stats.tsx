/**
 * Écran de statistiques
 * Affiche les logs et statistiques d'utilisation
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, DataTable, ProgressBar, Text } from 'react-native-paper';
import AppListService from '../../services/app-list.service';
import StorageService from '../../services/storage.service';
import { AppStats } from '../../types';

export default function StatsScreen() {
  const [stats, setStats] = useState<AppStats[]>([]);
  const [totalBlocked, setTotalBlocked] = useState(0);
  const [totalAllowed, setTotalAllowed] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const loadedStats = await StorageService.getStats();
      setStats(loadedStats.sort((a, b) => 
        (b.blockedAttempts + b.allowedAttempts) - (a.blockedAttempts + a.allowedAttempts)
      ));

      const blocked = loadedStats.reduce((sum, s) => sum + s.blockedAttempts, 0);
      const allowed = loadedStats.reduce((sum, s) => sum + s.allowedAttempts, 0);
      setTotalBlocked(blocked);
      setTotalAllowed(allowed);
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    }
  };

  const clearAllStats = async () => {
    try {
      await StorageService.clearStats();
      await loadStats();
    } catch (error) {
      console.error('Erreur lors de la suppression des stats:', error);
    }
  };

  const getAppName = async (packageName: string): Promise<string> => {
    const app = await AppListService.getAppByPackage(packageName);
    return app?.appName || packageName;
  };

  const totalAttempts = totalBlocked + totalAllowed;
  const blockedPercentage = totalAttempts > 0 ? (totalBlocked / totalAttempts) : 0;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Vue d'ensemble" />
        <Card.Content>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text variant="headlineLarge" style={styles.blockedText}>
                {totalBlocked}
              </Text>
              <Text variant="bodyMedium">Bloquées</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text variant="headlineLarge" style={styles.allowedText}>
                {totalAllowed}
              </Text>
              <Text variant="bodyMedium">Autorisées</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text variant="headlineLarge">
                {totalAttempts}
              </Text>
              <Text variant="bodyMedium">Total</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <Text variant="bodySmall" style={styles.progressLabel}>
              Taux de blocage: {(blockedPercentage * 100).toFixed(1)}%
            </Text>
            <ProgressBar 
              progress={blockedPercentage} 
              color="#d32f2f"
              style={styles.progressBar}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title 
          title="Détails par application" 
          right={(props) => (
            <Button 
              onPress={clearAllStats} 
              mode="text"
              compact
            >
              Effacer
            </Button>
          )}
        />
        <Card.Content>
          {stats.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucune statistique disponible
            </Text>
          ) : (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Application</DataTable.Title>
                <DataTable.Title numeric>Bloquées</DataTable.Title>
                <DataTable.Title numeric>Autorisées</DataTable.Title>
              </DataTable.Header>

              {stats.map((stat) => {
                const total = stat.blockedAttempts + stat.allowedAttempts;
                return (
                  <DataTable.Row key={stat.packageName}>
                    <DataTable.Cell>
                      <Text numberOfLines={1} style={styles.packageText}>
                        {stat.packageName.split('.').pop()}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text style={styles.blockedText}>
                        {stat.blockedAttempts}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text style={styles.allowedText}>
                        {stat.allowedAttempts}
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Informations" />
        <Card.Content>
          <Text variant="bodySmall" style={styles.infoText}>
            💡 Les statistiques sont mises à jour en temps réel lorsque les applications tentent d'accéder à Internet.
          </Text>
          <Text variant="bodySmall" style={styles.infoText}>
            🔒 En mode simulation, utilisez le bouton "Simuler une connexion" sur la page de détail d'une application pour générer des statistiques.
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  overviewItem: {
    alignItems: 'center',
  },
  blockedText: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  allowedText: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    marginBottom: 8,
    color: '#666',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 24,
  },
  packageText: {
    fontSize: 12,
  },
  infoText: {
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});