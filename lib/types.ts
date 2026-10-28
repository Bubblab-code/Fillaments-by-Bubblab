export type Market = "alta" | "media" | "baja";
export type Channel = "local" | "whatsapp";
export type Payment = "efectivo" | "nequi" | "transferencia";

export type Product = {
  id: string;
  kind: "filamento" | "resina";
  material: string;
  brand: string | null;
  color: string;
  hex: string;
  unit: string;
  cost: number | null;
  default_price: number | null;
  target: number;
  market: Market;
  on_demand: boolean;
  active: boolean;
  stock: number;
};

export type Customer = { id: string; name: string; phone: string | null };

export type Sale = {
  id: string;
  sale_date: string;
  customer_id: string | null;
  channel: Channel;
  payment: Payment;
  notes: string | null;
  total: number;
  created_by: string | null;
  created_at: string;
  inv_customers?: { name: string; phone: string | null } | null;
  inv_sale_items?: SaleItem[];
};

export type SaleItem = {
  id?: string;
  sale_id?: string;
  product_id: string;
  qty: number;
  unit_price: number;
  unit_cost: number | null;
};

export type OrderItem = { product_id: string; qty: number; label: string };

export type Order = {
  id: string;
  status: "pedido" | "recibido" | "cancelado";
  items: OrderItem[];
  message: string | null;
  created_by: string | null;
  created_at: string;
  received_at: string | null;
};

export type Settings = {
  supplier_name: string | null;
  supplier_whatsapp: string | null;
  lead_days: number;
  safety_days: number;
  min_order: number;
  coverage_months: number;
};
