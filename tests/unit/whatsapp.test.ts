import { describe, expect, it } from "vitest";
import { deliveryMessage, whatsappShareUrl } from "@/lib/whatsapp";

describe("whatsappShareUrl", () => {
  it("targets an international number written with + or 00", () => {
    expect(whatsappShareUrl("+225 07 12 34 56 78", "hi")).toBe("https://wa.me/2250712345678?text=hi");
    expect(whatsappShareUrl("00221 77 123 45 67", "hi")).toBe("https://wa.me/221771234567?text=hi");
  });

  it("lets WhatsApp pick the contact when the number has no country code or is missing", () => {
    expect(whatsappShareUrl("07 12 34 56 78", "hi")).toBe("https://wa.me/?text=hi");
    expect(whatsappShareUrl(null, "hi")).toBe("https://wa.me/?text=hi");
    expect(whatsappShareUrl("+12", "hi")).toBe("https://wa.me/?text=hi");
  });

  it("encodes the message", () => {
    expect(whatsappShareUrl(null, "a b&c\nd")).toBe("https://wa.me/?text=a%20b%26c%0Ad");
  });
});

describe("deliveryMessage", () => {
  it("greets by first name and lists one link plainly", () => {
    expect(deliveryMessage("Awa", [{ title: "Guide", url: "https://x/t/1" }], 7)).toBe(
      "Bonjour Awa,\nmerci pour votre achat. Voici votre lien de téléchargement (valable 7 jours) :\nhttps://x/t/1",
    );
  });

  it("names each file when there are several", () => {
    const text = deliveryMessage("", [{ title: "A", url: "u1" }, { title: "B", url: "u2" }], 3);
    expect(text).toContain("Bonjour,\n");
    expect(text).toContain("vos liens de téléchargement (valables 3 jours)");
    expect(text).toContain("A : u1\nB : u2");
  });
});
