/**
 * features/profiles/ProfileFormSheet.tsx — Créer ou renommer un profil
 *
 * Le nom suffit à créer un profil : les applications et les planifications
 * s'ajoutent ensuite depuis son détail. Exiger tout d'un coup ferait
 * abandonner la création.
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Spacing } from "@/theme";
import { Button, Chip, Section, Sheet, TextField } from "@/ui";

/** Intitulés fréquents — un tap remplit le champ. */
const SUGGESTIONS = [
  "Travail",
  "Étude",
  "Sommeil",
  "Détox",
  "Enfant",
  "Week-end",
  "Sport",
  "Repas",
];

const NAME_MAX = 32;
const DESCRIPTION_MAX = 90;

export type ProfileFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void> | void;
  /** Valeurs initiales — passe le panneau en mode modification. */
  initial?: { name: string; description?: string };
};

export function ProfileFormSheet({
  visible,
  onClose,
  onSubmit,
  initial,
}: ProfileFormSheetProps) {
  const editing = !!initial;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setError(null);
    setBusy(false);
  }, [visible, initial]);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Donnez un nom d'au moins deux caractères.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(trimmed, description.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? "Modifier le profil" : "Nouveau profil"}
      subtitle={
        editing
          ? undefined
          : "Un profil regroupe des règles de blocage que vous activez d'un geste."
      }
      scrollable={false}
      footer={
        <Button
          label={editing ? "Enregistrer" : "Créer le profil"}
          onPress={submit}
          loading={busy}
          disabled={busy}
          size="lg"
          fullWidth
        />
      }
    >
      <TextField
        label="Nom"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Mode travail"
        maxLength={NAME_MAX}
        counter
        icon="tag-outline"
        error={error ?? undefined}
        autoFocus={!editing}
        returnKeyType="next"
      />

      <TextField
        label="Description"
        hint="Optionnel — pour vous rappeler à quoi il sert."
        value={description}
        onChangeText={setDescription}
        placeholder="Bloque les réseaux sociaux en journée"
        maxLength={DESCRIPTION_MAX}
        counter
        icon="text-short"
        multiline
      />

      {!editing ? (
        <Section title="Suggestions">
          <View style={st.chips}>
            {SUGGESTIONS.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                active={name === suggestion}
                onPress={() => {
                  setName(suggestion);
                  setError(null);
                }}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
});
