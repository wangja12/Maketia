/**
 * A wa.me link that opens WhatsApp with the message ready to send. Nothing is sent by
 * Maketia: the creator taps "send" in WhatsApp. A number is only used when it is clearly
 * international (+ or 00 prefix); otherwise WhatsApp asks which contact to send it to.
 */
export function whatsappShareUrl(phone: string | null | undefined, text: string) {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") ? digits : raw.startsWith("00") ? digits.slice(2) : "";
  const to = international.length >= 8 && international.length <= 15 ? international : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** The message a buyer receives with their download links (formal register, buyer-facing). */
export function deliveryMessage(firstName: string | null | undefined, links: { title: string; url: string }[], days: number) {
  const hello = firstName?.trim() ? `Bonjour ${firstName.trim()},` : "Bonjour,";
  const list = links.map((l) => (links.length > 1 ? `${l.title} : ${l.url}` : l.url)).join("\n");
  const plural = links.length > 1;
  return `${hello}\nmerci pour votre achat. Voici ${plural ? "vos liens" : "votre lien"} de téléchargement (valable${plural ? "s" : ""} ${days} jours) :\n${list}`;
}
