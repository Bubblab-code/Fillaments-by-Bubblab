export function cop(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export const CHANNEL_LABEL: Record<string, string> = { local: "Local", whatsapp: "WhatsApp" };
export const PAYMENT_LABEL: Record<string, string> = { efectivo: "Efectivo", nequi: "Nequi", transferencia: "Transferencia" };
