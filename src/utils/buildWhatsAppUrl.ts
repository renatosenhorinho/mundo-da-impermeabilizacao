import { WHATSAPP_NUMBER } from "@/config/constants";

/**
 * Gera a URL do WhatsApp com mensagem pré-preenchida.
 * O sessionId é mantido na assinatura para compatibilidade com call sites
 * existentes e tracking interno — mas NÃO é inserido na mensagem visível.
 */
export function buildWhatsAppUrl(
  productName?: string,
  sessionId?: string  // mantido para tracking interno, não aparece na mensagem
) {
  const safeName = productName?.trim();

  const message = safeName
    ? `Olá! Vim pelo site e gostaria de um orçamento para: ${safeName}. Pode me ajudar?`
    : `Olá! Vim pelo site e gostaria de um orçamento sobre impermeabilização. Pode me ajudar?`;

  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
}
