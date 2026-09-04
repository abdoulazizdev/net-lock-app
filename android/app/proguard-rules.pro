# ─── Règles R8 / ProGuard — NetOff ───────────────────────────────────────────
#
# R8 est actif en release (`android.enableMinifyInReleaseBuilds`). Il réduit
# l'AAB et produit le fichier `mapping.txt` que Google Play utilise pour
# rendre les rapports de plantage lisibles.
#
# Les bibliothèques (React Native, Expo, RevenueCat…) embarquent leurs propres
# règles via leurs AAR. Ce fichier ne couvre donc que ce qui est spécifique au
# projet, plus quelques garde-fous sur du code atteint par réflexion.

# ── Modules natifs NetOff ────────────────────────────────────────────────────
# Le pont React instancie ces classes et appelle leurs méthodes par réflexion,
# et les services et receivers sont désignés par leur nom dans le manifeste.
# Le gain de taille sur ces quelques fichiers serait négligeable ; le risque de
# les voir renommés, non.
-keep class com.netoff.app.** { *; }

# ── React Native ─────────────────────────────────────────────────────────────
# Méthodes exposées à JavaScript, résolues par leur nom au moment de l'appel.
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    <init>(com.facebook.react.bridge.ReactApplicationContext);
}
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# ── Reanimated / Worklets ────────────────────────────────────────────────────
# Le moteur de worklets résout ses classes côté natif, à l'exécution.
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ── Hermes ───────────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ── RemoteViews du widget ────────────────────────────────────────────────────
# `RemoteViews.setInt(id, "setBackgroundResource", …)` désigne la méthode par
# son nom : elle ne doit pas être renommée.
-keepclassmembers class * extends android.view.View {
    public void setBackgroundResource(int);
    public void setBackgroundColor(int);
}

# ── Achats intégrés ──────────────────────────────────────────────────────────
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

# ── Confort de débogage ──────────────────────────────────────────────────────
# Conserve les numéros de ligne dans les traces, tout en masquant les noms de
# fichiers source. `mapping.txt` permet ensuite de retrouver les vrais noms.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
