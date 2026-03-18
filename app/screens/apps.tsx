import React, { useEffect, useState } from "react";
import { Button, FlatList, Text, TouchableOpacity, View } from "react-native";

import { getUsageStats, openUsageAccessSettings } from "@/services/usageStats";

export default function App() {
  const [apps, setApps] = useState<any[]>([]);

  const loadApps = async () => {
    const data = await getUsageStats();

    if (!data || data.length === 0) {
      setApps([]);
      return;
    }

    // tri par dernière utilisation
    const sorted = data.sort(
      (a: any, b: any) => b.lastTimeUsed - a.lastTimeUsed,
    );

    setApps(sorted);
  };

  useEffect(() => {
    loadApps();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>
        Applications utilisées
      </Text>

      {apps.length === 0 && (
        <View style={{ marginTop: 20 }}>
          <Text>Activez l'accès aux statistiques d'utilisation</Text>
          <Button title="Activer" onPress={openUsageAccessSettings} />
        </View>
      )}

      <FlatList
        data={apps}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 15,
              borderBottomWidth: 1,
            }}
          >
            <Text>{item.packageName}</Text>
            <Text>
              Dernière utilisation :{" "}
              {new Date(item.lastTimeUsed).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
