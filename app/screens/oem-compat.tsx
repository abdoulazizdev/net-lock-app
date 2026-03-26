/**
 * OemCompatScreen.tsx — Écran de compatibilité OEM
 * Accessible depuis Settings → section "Compatibilité appareil"
 *
 * Affiche :
 * 1. Diagnostic de l'appareil (OEM détecté, statut batterie)
 * 2. Instructions étape par étape adaptées à l'OEM
 * 3. Boutons d'action directs vers les bons paramètres système
 */

import OemCompatService, {
    DeviceInfo,
    OEM_GUIDANCE,
    OemType,
} from "@/services/oem-compat.service";
import VpnService from "@/services/vpn.service";
import { Colors, Semantic, useTheme } from "@/theme";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Animated,
    Easing,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function StepItem({
  num,
  text,
  done,
}: {
  num: number;
  text: string;
  done?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View style={sc.stepRow}>
      <View
        style={[
          sc.stepNum,
          { backgroundColor: done ? Colors.green[400] : Colors.blue[500] },
        ]}
      >
        <Text style={sc.stepNumText}>{done ? "✓" : num}</Text>
      </View>
      <Text style={[sc.stepText, { color: t.text.secondary }]}>{text}</Text>
    </View>
  );
}

function ActionBtn({
  label,
  sub,
  icon,
  onPress,
  color = Colors.blue[600],
}: {
  label: string;
  sub?: string;
  icon: string;
  onPress: () => void;
  color?: string;
}) {
  const { t } = useTheme();
  return (
    <TouchableOpacity
      style={[
        sc.actionBtn,
        { backgroundColor: color + "18", borderColor: color + "40" },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[sc.actionBtnLabel, { color }]}>{label}</Text>
        {sub && (
          <Text style={[sc.actionBtnSub, { color: t.text.muted }]}>{sub}</Text>
        )}
      </View>
      <Text style={[{ fontSize: 18, color }]}>›</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const { t } = useTheme();
  return (
    <View
      style={[
        sc.statusPill,
        {
          backgroundColor: ok ? t.allowed.bg : t.danger.bg,
          borderColor: ok ? t.allowed.border : t.danger.border,
        },
      ]}
    >
      <View
        style={[
          sc.statusDot,
          { backgroundColor: ok ? t.allowed.accent : t.danger.accent },
        ]}
      />
      <Text
        style={[sc.statusLabel, { color: ok ? t.allowed.text : t.danger.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function OemCompatScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [vpnActive, setVpnActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionDone, setActionDone] = useState<string[]>([]);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [deviceInfo, vpn] = await Promise.all([
      OemCompatService.getDeviceInfo(),
      VpnService.isVpnActive(),
    ]);
    setInfo(deviceInfo);
    setVpnActive(vpn);
    setLoading(false);
  };

  const markDone = (key: string) =>
    setActionDone((prev) => [...new Set([...prev, key])]);

  if (loading)
    return (
      <View
        style={[
          sc.container,
          {
            backgroundColor: t.bg.page,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: t.text.muted }}>Détection de l'appareil…</Text>
      </View>
    );

  const oem = (info?.oem ?? "generic") as OemType;
  const guidance = OEM_GUIDANCE[oem] ?? OEM_GUIDANCE.generic;
  const isBatOptimized = info?.isBatteryOptimized ?? false;
  const hasAutoStart = info?.hasAutoStartSetting ?? false;
  const severityColor =
    guidance.severity === "high"
      ? (Colors.red[500] ?? t.danger.accent)
      : guidance.severity === "medium"
        ? Colors.amber[500]
        : Colors.green[400];
  const severityLabel =
    guidance.severity === "high"
      ? "Configuration requise"
      : guidance.severity === "medium"
        ? "Configuration recommandée"
        : "Appareil compatible";

  return (
    <View style={[sc.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      <View
        style={[
          sc.header,
          { paddingTop: insets.top + 10, backgroundColor: Semantic.bg.header },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={sc.backBtn}>
          <Text style={sc.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={sc.headerContent}>
          <View style={sc.headerIconWrap}>
            <Text style={{ fontSize: 20, color: Colors.gray[0] }}>🔧</Text>
          </View>
          <View>
            <Text style={sc.headerTitle}>Compatibilité appareil</Text>
            <Text style={sc.headerSub}>{guidance.name}</Text>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          sc.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Diagnostic ── */}
        <Text style={[sc.sectionLabel, { color: t.text.muted }]}>
          DIAGNOSTIC
        </Text>
        <View
          style={[
            sc.diagCard,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <View style={sc.diagRow}>
            <Text style={[sc.diagLabel, { color: t.text.muted }]}>
              Appareil
            </Text>
            <Text style={[sc.diagValue, { color: t.text.primary }]}>
              {info?.brand ?? "?"} {info?.model ?? ""}
            </Text>
          </View>
          <View style={[sc.diagDivider, { backgroundColor: t.border.light }]} />
          <View style={sc.diagRow}>
            <Text style={[sc.diagLabel, { color: t.text.muted }]}>Android</Text>
            <Text style={[sc.diagValue, { color: t.text.primary }]}>
              {info?.androidVersion ?? "?"} (API {info?.sdkInt})
            </Text>
          </View>
          <View style={[sc.diagDivider, { backgroundColor: t.border.light }]} />
          <View style={sc.diagRow}>
            <Text style={[sc.diagLabel, { color: t.text.muted }]}>
              Profil OEM
            </Text>
            <View
              style={[
                sc.severityBadge,
                {
                  backgroundColor: severityColor + "18",
                  borderColor: severityColor + "40",
                },
              ]}
            >
              <Text style={[sc.severityText, { color: severityColor }]}>
                {severityLabel}
              </Text>
            </View>
          </View>
          <View style={[sc.diagDivider, { backgroundColor: t.border.light }]} />
          <View style={sc.diagRow}>
            <Text style={[sc.diagLabel, { color: t.text.muted }]}>VPN</Text>
            <StatusPill
              ok={vpnActive}
              label={vpnActive ? "Actif" : "Inactif"}
            />
          </View>
          <View style={[sc.diagDivider, { backgroundColor: t.border.light }]} />
          <View style={sc.diagRow}>
            <Text style={[sc.diagLabel, { color: t.text.muted }]}>
              Optim. batterie
            </Text>
            <StatusPill
              ok={!isBatOptimized}
              label={isBatOptimized ? "Activée ⚠" : "Désactivée ✓"}
            />
          </View>
        </View>

        {/* ── Avertissement OEM critique ── */}
        {guidance.severity === "high" && (
          <View
            style={[
              sc.warnBanner,
              { backgroundColor: t.danger.bg, borderColor: t.danger.border },
            ]}
          >
            <Text style={{ fontSize: 20 }}>⚠</Text>
            <View style={{ flex: 1 }}>
              <Text style={[sc.warnTitle, { color: t.danger.text }]}>
                {guidance.name} — configuration requise
              </Text>
              <Text style={[sc.warnSub, { color: t.text.muted }]}>
                Cet appareil tue agressivement les services en arrière-plan.
                Sans configuration, le VPN NetOff sera stoppé dès que l'app est
                fermée.
              </Text>
            </View>
          </View>
        )}

        {/* ── Actions rapides ── */}
        <Text style={[sc.sectionLabel, { color: t.text.muted, marginTop: 20 }]}>
          ACTIONS RAPIDES
        </Text>
        <ActionBtn
          icon="🔋"
          label={guidance.batteryLabel}
          sub="Ouvre directement les paramètres de batterie adaptés"
          color={
            isBatOptimized
              ? (Colors.red[500] ?? t.danger.accent)
              : Colors.green[400]
          }
          onPress={async () => {
            await OemCompatService.openBatterySettings();
            markDone("battery");
            // Re-check après retour
            setTimeout(async () => {
              OemCompatService.invalidateCache();
              await loadAll();
            }, 1500);
          }}
        />
        {hasAutoStart && (
          <ActionBtn
            icon="🚀"
            label={guidance.autoStartLabel}
            sub="Nécessaire pour que NetOff démarre avec l'appareil"
            color={Colors.blue[500]}
            onPress={async () => {
              await OemCompatService.openAutoStartSettings();
              markDone("autostart");
            }}
          />
        )}
        <ActionBtn
          icon="🛑"
          label="Ignorer l'optimisation batterie (Android)"
          sub="Paramètre Android standard — complément des réglages OEM"
          color={Colors.purple[400]}
          onPress={async () => {
            await OemCompatService.requestIgnoreBatteryOptimization();
            markDone("ignore_bat");
            setTimeout(async () => {
              OemCompatService.invalidateCache();
              await loadAll();
            }, 1500);
          }}
        />
        <ActionBtn
          icon="🔔"
          label="Paramètres de notifications"
          sub="Assurez-vous que les notifications NetOff sont activées"
          color={Colors.blue[400]}
          onPress={() => OemCompatService.openNotificationSettings()}
        />

        {/* ── Guide batterie étape par étape ── */}
        <Text style={[sc.sectionLabel, { color: t.text.muted, marginTop: 20 }]}>
          GUIDE BATTERIE — {guidance.name.toUpperCase()}
        </Text>
        <View
          style={[
            sc.guideCard,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <View style={[sc.guideAccent, { backgroundColor: severityColor }]} />
          {guidance.batterySteps.map((step, i) => (
            <StepItem
              key={i}
              num={i + 1}
              text={step}
              done={actionDone.includes("battery") && i < 2}
            />
          ))}
        </View>

        {/* ── Guide AutoStart ── */}
        {hasAutoStart && (
          <>
            <Text
              style={[sc.sectionLabel, { color: t.text.muted, marginTop: 16 }]}
            >
              GUIDE AUTOSTART — {guidance.name.toUpperCase()}
            </Text>
            <View
              style={[
                sc.guideCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <View
                style={[sc.guideAccent, { backgroundColor: Colors.blue[500] }]}
              />
              {guidance.autoStartSteps.map((step, i) => (
                <StepItem
                  key={i}
                  num={i + 1}
                  text={step}
                  done={actionDone.includes("autostart") && i < 2}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Checklist finale ── */}
        <Text style={[sc.sectionLabel, { color: t.text.muted, marginTop: 20 }]}>
          VÉRIFICATION FINALE
        </Text>
        <View
          style={[
            sc.checklistCard,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          {[
            {
              key: "bat",
              label: "Optimisation batterie désactivée",
              ok: !isBatOptimized,
            },
            {
              key: "autostart",
              label: "AutoStart activé (si disponible)",
              ok: actionDone.includes("autostart") || !hasAutoStart,
            },
            { key: "notif", label: "Notifications activées", ok: true },
            { key: "vpn", label: "VPN actif", ok: vpnActive },
          ].map((item, i) => (
            <View
              key={item.key}
              style={[
                sc.checkRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: t.border.light,
                },
              ]}
            >
              <View
                style={[
                  sc.checkIcon,
                  {
                    backgroundColor: item.ok ? t.allowed.bg : t.danger.bg,
                    borderColor: item.ok ? t.allowed.border : t.danger.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: item.ok ? t.allowed.accent : t.danger.accent,
                  }}
                >
                  {item.ok ? "✓" : "✕"}
                </Text>
              </View>
              <Text
                style={[
                  sc.checkLabel,
                  { color: item.ok ? t.text.primary : t.text.muted },
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Bouton re-vérifier */}
        <TouchableOpacity
          style={[
            sc.recheckBtn,
            { backgroundColor: t.bg.accent, borderColor: t.border.strong },
          ]}
          onPress={loadAll}
          activeOpacity={0.8}
        >
          <Text style={[sc.recheckText, { color: t.text.link }]}>
            ↺ Actualiser le diagnostic
          </Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  backBtn: { marginBottom: 14 },
  backText: { color: Colors.gray[0], fontSize: 14, fontWeight: "600" },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.blue[200],
    marginTop: 2,
    fontWeight: "500",
  },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 10,
  },

  // Diagnostic
  diagCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  diagDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  diagLabel: { fontSize: 12, fontWeight: "600" },
  diagValue: { fontSize: 12, fontWeight: "600" },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityText: { fontSize: 11, fontWeight: "700" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: "700" },

  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  warnTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  warnSub: { fontSize: 12, lineHeight: 18 },

  // Action buttons
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionBtnLabel: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  actionBtnSub: { fontSize: 11 },

  // Guide
  guideCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  guideAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingLeft: 8,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  stepNumText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  stepText: { fontSize: 13, lineHeight: 20, flex: 1 },

  // Checklist
  checklistCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  checkLabel: { fontSize: 13, fontWeight: "500", flex: 1 },

  recheckBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  recheckText: { fontSize: 14, fontWeight: "700" },
});
