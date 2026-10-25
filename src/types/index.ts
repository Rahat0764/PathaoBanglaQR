export interface MerchantProfile {
  id: string;
  user_id: string;
  merchant_name: string;
  merchant_city: string;
  account_number: string;
  mcc: string;
  currency: string;
  country: string;
  raw_template: string; // original QR string used as template
  created_at: string;
  updated_at: string;
}
