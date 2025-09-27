export interface OrderItem {
  name: string;
  size?: string;
  modifiers?: string[];
}
export interface OrderJSON {
  items: OrderItem[];
  fulfillment: { type: "pickup" | "delivery"; time: string };
  customer: { name: string; phone: string };
  payment: { type: "card_test" };
  _requestedBy?: string;
}
