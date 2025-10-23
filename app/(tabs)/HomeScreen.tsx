/**
 * Écran principal - Liste des applications avec contrôles
 */

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, FAB, List, Searchbar, Switch, Text } from 'react-native-paper';
import AppListService from '../../services/app-list.service';
import StorageService from '../../services/storage.service';
import VpnSimulatorService from '../../services/vpn-simulator.service';
import { InstalledApp } from '../../types';
import { RootStackParamList } from '../../types/navigation';
export default function HomeScreen() {
    type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

    const navigation = useNavigation<HomeScreenNavigationProp>();  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [filteredApps, setFilteredApps] = useState<InstalledApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [showSystemApps, setShowSystemApps] = useState(false);

  useEffect(() => {
    loadApps();
    checkVpnStatus();
  }, []);

  useEffect(() => {
    filterApps();
  }, [searchQuery, apps, showSystemApps]);

  const loadApps = async () => {
    try {
      setLoading(true);
      const installedApps = await AppListService.getInstalledApps();
      setApps(installedApps);
      
      // Charge l'état de blocage de chaque app
      const rules = await StorageService.getRules();
      const blocked = new Set(
        rules.filter(r => r.isBlocked).map(r => r.packageName)
      );
      setBlockedApps(blocked);
    } catch (error) {
      console.error('Erreur lors du chargement des apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkVpnStatus = async () => {
    const active = await VpnSimulatorService.isVpnActive();
    setVpnActive(active);
  };

  const filterApps = () => {
    let filtered = apps;

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.appName.toLowerCase().includes(query) ||
        app.packageName.toLowerCase().includes(query)
      );
    }

    // Filtre apps système
    if (!showSystemApps) {
      filtered = filtered.filter(app => !app.isSystemApp);
    }

    setFilteredApps(filtered);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadApps();
    await checkVpnStatus();
    setRefreshing(false);
  }, []);

  const toggleAppBlock = async (packageName: string, currentBlocked: boolean) => {
    try {
      const newBlocked = !currentBlocked;
      await VpnSimulatorService.setRule(packageName, newBlocked);
      
      setBlockedApps(prev => {
        const updated = new Set(prev);
        if (newBlocked) {
          updated.add(packageName);
        } else {
          updated.delete(packageName);
        }
        return updated;
      });
    } catch (error) {
      console.error('Erreur lors du changement de règle:', error);
    }
  };

  const toggleVpn = async () => {
    try {
      if (vpnActive) {
        await VpnSimulatorService.stopVpn();
        setVpnActive(false);
      } else {
        const started = await VpnSimulatorService.startVpn();
        setVpnActive(started);
      }
    } catch (error) {
      console.error('Erreur lors du toggle VPN:', error);
    }
  };

  const renderAppItem = ({ item }: { item: InstalledApp }) => {
    const isBlocked = blockedApps.has(item.packageName);

    return (
      <List.Item
        title={item.appName}
        description={item.packageName}
        left={props => (
          <List.Icon {...props} icon={item.isSystemApp ? 'cog' : 'application'} />
        )}
        right={() => (
          <Switch
            value={!isBlocked}
            onValueChange={() => toggleAppBlock(item.packageName, isBlocked)}
            disabled={!vpnActive}
          />
        )}
        onPress={() => navigation.navigate('AppDetail', { packageName: item.packageName })}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Chargement des applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Rechercher une application"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <View style={styles.chipContainer}>
          <Chip
            icon={vpnActive ? 'shield-check' : 'shield-off'}
            selected={vpnActive}
            onPress={toggleVpn}
            style={styles.chip}
          >
            VPN {vpnActive ? 'Actif' : 'Inactif'}
          </Chip>
          
          <Chip
            icon={showSystemApps ? 'eye' : 'eye-off'}
            selected={showSystemApps}
            onPress={() => setShowSystemApps(!showSystemApps)}
            style={styles.chip}
          >
            Apps système
          </Chip>
        </View>

        <Text variant="bodySmall" style={styles.appCount}>
          {filteredApps.length} application(s) • {blockedApps.size} bloquée(s)
        </Text>
      </View>

      <FlatList
        data={filteredApps}
        renderItem={renderAppItem}
        keyExtractor={item => item.packageName}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="cog"
        style={styles.fab}
        onPress={() => navigation.navigate('Settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  searchBar: {
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flex: 1,
  },
  appCount: {
    color: '#666',
    marginTop: 4,
  },
  list: {
    paddingBottom: 80,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});