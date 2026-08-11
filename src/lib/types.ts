// Tipos de dominio (espejo del esquema en supabase/migrations)

export type Role = "admin" | "advisor" | "analyst";
export type Channel = "whatsapp" | "messenger";
export type SourceChannel = Channel | "referral" | "walk_in" | "other";
export type ConversationStatus = "bot" | "human" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type SenderType = "client" | "bot" | "agent";
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "template"
  | "sticker"
  | "other";
export type MessageStatus =
  | "received"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";
export type LeadStage =
  | "new"
  | "contacted"
  | "interested"
  | "applying"
  | "discarded";
export type ApplicationStatus =
  | "draft"
  | "docs_pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "disbursed"
  | "cancelled";
export type CollateralType = "property" | "car" | "machinery" | "other";
export type BorrowerType = "personal" | "business";
export type DocType =
  | "credit_application"
  | "bureau_authorization"
  | "ine"
  | "proof_of_address"
  | "proof_of_income"
  | "bank_statement"
  | "collateral"
  | "aval_ine"
  | "other";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type LoanStatus = "active" | "paid_off" | "overdue" | "written_off";
export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue";
export type PaymentMethod = "cash" | "transfer" | "deposit";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  full_name: string;
  phone: string | null;
  wa_id: string | null;
  messenger_psid: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  source_channel: SourceChannel;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  contact_id: string;
  channel: Channel;
  external_thread_id: string;
  status: ConversationStatus;
  assigned_to: string | null;
  bot_paused_until: string | null;
  last_message_at: string;
  last_inbound_at: string | null;
  last_preview: string;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender_type: SenderType;
  sender_profile_id: string | null;
  message_type: MessageType;
  body: string;
  media_url: string | null;
  media_storage_path: string | null;
  external_message_id: string | null;
  status: MessageStatus;
  error_detail: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  contact_id: string;
  stage: LeadStage;
  interest_amount: number | null;
  assigned_to: string | null;
  discard_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanApplication {
  id: string;
  folio: number;
  contact_id: string;
  lead_id: string | null;
  requested_amount: number | null;
  term_weeks: number | null;
  purpose: string | null;
  borrower_type: BorrowerType;
  business_name: string | null;
  collateral_type: CollateralType | null;
  collateral_description: string | null;
  has_aval: boolean;
  aval_name: string | null;
  aval_phone: string | null;
  status: ApplicationStatus;
  approved_amount: number | null;
  approved_term_weeks: number | null;
  weekly_rate: number;
  advisor_id: string | null;
  analyst_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStatusHistory {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface UploadToken {
  id: string;
  token_hash: string;
  application_id: string;
  contact_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_by: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  application_id: string;
  contact_id: string;
  doc_type: DocType;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_via: "portal" | "staff";
  upload_token_id: string | null;
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  folio: number;
  application_id: string;
  contact_id: string;
  principal: number;
  weekly_rate: number;
  term_weeks: number;
  weekly_payment: number;
  disbursed_at: string;
  first_payment_date: string;
  status: LoanStatus;
  created_at: string;
}

export interface Installment {
  id: string;
  loan_id: string;
  number: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  paid_amount: number;
  status: InstallmentStatus;
  paid_at: string | null;
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  received_by: string | null;
  note: string | null;
  created_at: string;
}

export interface LoanBalance {
  loan_id: string;
  folio: number;
  contact_id: string;
  status: LoanStatus;
  principal: number;
  weekly_payment: number;
  disbursed_at: string;
  principal_paid: number;
  outstanding_principal: number;
  overdue_count: number;
  overdue_amount: number;
  oldest_overdue_date: string | null;
  days_late: number;
}
