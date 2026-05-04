import { WHATSAPP_NUMBER } from "@/config/constants";
import { getSessionId } from "@/data/products"; // getSessionId is in products.ts right now. wait, I should check.

export function buildWhatsAppUrl(productName?: string) {
  let message = "Olá! Estou no site e gostaria de ajuda para escolher o produto ideal.";

  if (productName) {
    message = `Olá, vi o produto ${productName} no site e gostaria de um orçamento.`;
  }

  // Adding sessionId if needed, but the prompt says "Olá, vi o produto {{nome_produto}} no site e gostaria de um orçamento."
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
}
