/**
 * Écran de gestion des profils
 * Permet de créer des ensembles de règles prédéfinis
 */

import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Dialog, FAB, List, Portal, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import StorageService from '../../services/storage.service';
import { Profile } from '../../types';

export default function ProfilesScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await StorageService.getProfiles();
      setProfiles(loadedProfiles);

      const activeProfile = await StorageService.getActiveProfile();
      setActiveProfileId(activeProfile?.id || null);
    } catch (error) {
      console.error('Erreur lors du chargement des profils:', error);
    }
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) {
      Alert.alert('Erreur', 'Le nom du profil est requis');
      return;
    }

    try {
      const newProfile: Profile = {
        id: `profile_${Date.now()}`,
        name: newProfileName,
        description: newProfileDesc,
        isActive: false,
        rules: [],
        createdAt: new Date(),
      };

      await StorageService.saveProfile(newProfile);
      await loadProfiles();
      
      setDialogVisible(false);
      setNewProfileName('');
      setNewProfileDesc('');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le profil');
    }
  };

  const deleteProfile = async (profileId: string) => {
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer ce profil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.deleteProfile(profileId);
              if (activeProfileId === profileId) {
                await StorageService.setActiveProfile(null);
                setActiveProfileId(null);
              }
              await loadProfiles();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le profil');
            }
          },
        },
      ]
    );
  };

  const activateProfile = async (profileId: string) => {
    try {
      await StorageService.setActiveProfile(profileId);
      setActiveProfileId(profileId);
      Alert.alert('Succès', 'Profil activé');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'activer le profil');
    }
  };

  const deactivateProfile = async () => {
    try {
      await StorageService.setActiveProfile(null);
      setActiveProfileId(null);
      Alert.alert('Succès', 'Profil désactivé');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de désactiver le profil');
    }
  };

  const renderProfileItem = ({ item }: { item: Profile }) => {
    const isActive = item.id === activeProfileId;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <List.Item
                title={item.name}
                description={item.description || 'Aucune description'}
                left={props => <List.Icon {...props} icon="account-circle" />}
              />
            </View>
            {isActive && (
              <Chip icon="check" style={styles.activeChip}>
                Actif
              </Chip>
            )}
          </View>

          <View style={styles.profileStats}>
            <Chip icon="shield" compact>
              {item.rules.length} règle(s)
            </Chip>
          </View>

          <View style={styles.actions}>
            {isActive ? (
              <Button
                mode="outlined"
                onPress={deactivateProfile}
                style={styles.actionButton}
              >
                Désactiver
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={() => activateProfile(item.id)}
                style={styles.actionButton}
              >
                Activer
              </Button>
            )}
            <Button
              mode="text"
              onPress={() => deleteProfile(item.id)}
              textColor="#d32f2f"
            >
              Supprimer
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {profiles.length === 0 ? (
        <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-multiple" size={64} color="#ccc" />

          <Button mode="outlined" onPress={() => setDialogVisible(true)}>
            Créer votre premier profil
          </Button>
        </View>
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderProfileItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setDialogVisible(true)}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Nouveau profil</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nom du profil"
              value={newProfileName}
              onChangeText={setNewProfileName}
              mode="outlined"
              style={styles.input}
              placeholder="Ex: Enfant, Travail, Gaming..."
            />
            <TextInput
              label="Description (optionnel)"
              value={newProfileDesc}
              onChangeText={setNewProfileDesc}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Annuler</Button>
            <Button onPress={createProfile}>Créer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  activeChip: {
    backgroundColor: '#4caf50',
  },
  profileStats: {
    marginTop: 8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  input: {
    marginBottom: 12,
  },
});