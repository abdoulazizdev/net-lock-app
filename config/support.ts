/**
 * config/support.ts — Coordonnées de contact direct
 *
 * Une seule source de vérité pour l'e-mail et le WhatsApp du support : la page
 * « Nous écrire », la page « À propos » et le paywall pointent tous ici. Quand
 * le paiement du store est indisponible, ces coordonnées sont la seule voie
 * d'accès à Pro — elles ne doivent jamais diverger d'un écran à l'autre.
 */

/** Numéro WhatsApp au format international, sans « + » ni espaces (wa.me). */
const WHATSAPP_E164 = "212646534846";

export const SUPPORT = {
  email: "abdoulaziz.dev@gmail.com",
  /** Pour `wa.me` et les liens `tel:`. */
  whatsapp: WHATSAPP_E164,
  /** Version lisible, à afficher. */
  whatsappDisplay: "+212 646 534 846",
} as const;

/** Lien WhatsApp — s'ouvre dans l'app si elle est installée, sinon dans le navigateur. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent(message)}`;
}

/** Lien `mailto:` avec sujet et corps pré-remplis. */
export function mailtoUrl(subject: string, body?: string): string {
  const query = [`subject=${encodeURIComponent(subject)}`];
  if (body) query.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT.email}?${query.join("&")}`;
}

/** Lien d'appel direct. */
export function telUrl(): string {
  return `tel:+${SUPPORT.whatsapp}`;
}
