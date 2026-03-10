/**
 * Écran des paramètres
 * Configuration de l'authentification, export/import, infos système
 */

import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet } from 'react-native';
import { Button, Dialog, Divider, List, Portal, Switch, Text } from 'react-native-paper';
import StorageService from '../../services/storage.service';
import VpnSimulatorService from '../../services/vpn-simulator.service';

export default function SettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [vpnStatus, setVpnStatus] = useState({ isActive: false, isNative: false, platform: '' });

  useEffect(() => {
    loadSettings();
    checkBiometric();
    loadVpnStatus();
  }, []);

  const loadSettings = async () => {
    const config = await StorageService.getAuthConfig();
    setBiometricEnabled(config.isBiometricEnabled);
  };

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  const loadVpnStatus = () => {
    const status = VpnSimulatorService.getStatus();
    setVpnStatus(status);
  };

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirmer l\'activation de la biométrie',
        });
        if (result.success) {
          await StorageService.updateAuthConfig({ isBiometricEnabled: true });
          setBiometricEnabled(true);
        }
      } else {
        await StorageService.updateAuthConfig({ isBiometricEnabled: false });
        setBiometricEnabled(false);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier les paramètres biométriques');
    }
  };

  const handleExport = async () => {
    try {
      const jsonData = await StorageService.exportData();
      
      // Option 1: Partager via le système
      await Share.share({
        message: jsonData,
        title: 'Export des règles Internet Control',
      });
      
      setExportDialogVisible(false);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'exporter les données');
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import de données',
      'Collez le JSON exporté précédemment',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Importer',
          onPress: () => {
            // Dans une vraie app, ouvrir un sélecteur de fichier
            Alert.alert('Info', 'Fonctionnalité à implémenter avec un sélecteur de fichier');
          },
        },
      ]
    );
  };

  const clearAllData = () => {
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.clearStats();
              // Ici vous pouvez aussi effacer les règles et profils si nécessaire
              Alert.alert('Succès', 'Toutes les données ont été effacées');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'effacer les données');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <List.Section>
        <List.Subheader>Sécurité</List.Subheader>
        
        <List.Item
          title="Authentification biométrique"
          description={
            biometricAvailable 
              ? "Utiliser Face ID / Touch ID" 
              : "Non disponible sur cet appareil"
          }
          left={props => <List.Icon {...props} icon="fingerprint" />}
          right={() => (
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              disabled={!biometricAvailable}
            />
          )}
        />
        
        <List.Item
          title="Changer le PIN"
          description="Modifier le code PIN de sécurité"
          left={props => <List.Icon {...props} icon="lock-reset" />}
          onPress={() => Alert.alert('Info', 'Fonctionnalité à implémenter')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>VPN & Contrôle</List.Subheader>
        
        <List.Item
          title="Statut du VPN"
          description={vpnStatus.isActive ? 'Actif' : 'Inactif'}
          left={props => <List.Icon {...props} icon={vpnStatus.isActive ? 'shield-check' : 'shield-off'} />}
        />
        
        <List.Item
          title="Mode de fonctionnement"
          description={vpnStatus.isNative ? 'Natif (VPNService)' : 'Simulation'}
          left={props => <List.Icon {...props} icon="cog" />}
        />
        
        <List.Item
          title="Plateforme"
          description={vpnStatus.platform}
          left={props => <List.Icon {...props} icon="cellphone" />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Données</List.Subheader>
        
        <List.Item
          title="Exporter les règles"
          description="Sauvegarder les règles et profils"
          left={props => <List.Icon {...props} icon="export" />}
          onPress={() => setExportDialogVisible(true)}
        />
        
        <List.Item
          title="Importer les règles"
          description="Restaurer des règles sauvegardées"
          left={props => <List.Icon {...props} icon="import" />}
          onPress={handleImport}
        />
        
        <List.Item
          title="Effacer toutes les données"
          description="Supprimer règles, profils et statistiques"
          left={props => <List.Icon {...props} icon="delete-forever" />}
          onPress={clearAllData}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>À propos</List.Subheader>
        
        <List.Item
          title="Version"
          description="1.0.0"
          left={props => <List.Icon {...props} icon="information" />}
        />
        
        <List.Item
          title="Documentation"
          description="Guide d'utilisation et FAQ"
          left={props => <List.Icon {...props} icon="book-open" />}
          onPress={() => Alert.alert('Info', 'Consultez le README.md du projet')}
        />
      </List.Section>

      <Portal>
        <Dialog visible={exportDialogVisible} onDismiss={() => setExportDialogVisible(false)}>
          <Dialog.Title>Exporter les données</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Les règles, profils et statistiques seront exportés au format JSON. 
              Vous pourrez partager ce fichier ou le sauvegarder.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExportDialogVisible(false)}>Annuler</Button>
            <Button onPress={handleExport}>Exporter</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});