/**
 * Écran d'authentification (PIN + Biométrie)
 */

import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import StorageService from '../../services/storage.service';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [pin, setPin] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuthSetup();
    checkBiometric();
  }, []);

  const checkAuthSetup = async () => {
    const config = await StorageService.getAuthConfig();
    setIsFirstTime(!config.isPinEnabled);
  };

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authentification requise',
        fallbackLabel: 'Utiliser le PIN',
      });

      if (result.success) {
        onAuthenticated();
      }
    } catch (error) {
      Alert.alert('Erreur', 'Échec de l\'authentification biométrique');
    }
  };

  const handlePinSubmit = async () => {
    setLoading(true);
    try {
      if (isFirstTime) {
        // Configuration initiale du PIN
        if (pin.length < 4) {
          Alert.alert('Erreur', 'Le PIN doit contenir au moins 4 chiffres');
          setLoading(false);
          return;
        }

        if (!confirmPin) {
          Alert.alert('Confirmation', 'Veuillez confirmer votre PIN');
          setLoading(false);
          return;
        }

        if (pin !== confirmPin) {
          Alert.alert('Erreur', 'Les PINs ne correspondent pas');
          setLoading(false);
          return;
        }

        await StorageService.savePin(pin);
        Alert.alert('Succès', 'PIN configuré avec succès');
        onAuthenticated();
      } else {
        // Vérification du PIN
        const isValid = await StorageService.verifyPin(pin);
        if (isValid) {
          onAuthenticated();
        } else {
          Alert.alert('Erreur', 'PIN incorrect');
          setPin('');
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            {isFirstTime ? 'Configuration du PIN' : 'Authentification'}
          </Text>

          <TextInput
            label="PIN"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            maxLength={6}
          />

          {isFirstTime && (
            <TextInput
              label="Confirmer le PIN"
              value={confirmPin}
              onChangeText={setConfirmPin}
              secureTextEntry
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              maxLength={6}
            />
          )}

          <Button
            mode="contained"
            onPress={handlePinSubmit}
            loading={loading}
            disabled={loading || !pin}
            style={styles.button}
          >
            {isFirstTime ? 'Configurer' : 'Déverrouiller'}
          </Button>

          {!isFirstTime && biometricAvailable && (
            <Button
              mode="outlined"
              onPress={handleBiometricAuth}
              style={styles.button}
              icon="fingerprint"
            >
              Utiliser la biométrie
            </Button>
          )}

          {isFirstTime && (
            <Text variant="bodySmall" style={styles.hint}>
              Le PIN sécurise l'accès aux paramètres de l'application
            </Text>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  hint: {
    marginTop: 16,
    textAlign: 'center',
    color: '#666',
  },
});