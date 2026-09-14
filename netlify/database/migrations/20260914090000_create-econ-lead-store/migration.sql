CREATE TABLE IF NOT EXISTS leads (
  session_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  street TEXT,
  civic TEXT,
  municipality TEXT,
  province TEXT,
  phone TEXT,
  profile_type TEXT,
  privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT,
  format TEXT,
  wave TEXT,
  cluster TEXT,
  point_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
);

CREATE TABLE IF NOT EXISTS verifications (
  verification_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES leads(session_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  owner_status TEXT,
  pv_existing TEXT,
  bill_path TEXT,
  bill_file_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
  annual_kwh NUMERIC,
  annual_spend NUMERIC,
  data_quality TEXT,
  purchase_saving_low NUMERIC,
  purchase_saving_high NUMERIC,
  pv_saving_low NUMERIC,
  pv_saving_high NUMERIC,
  total_saving_low NUMERIC,
  total_saving_high NUMERIC,
  calculation_version TEXT,
  benchmark_version TEXT,
  lead_type TEXT,
  fv_intent TEXT,
  contact_preference TEXT,
  document_id TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES leads(session_id) ON DELETE CASCADE,
  verification_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  blob_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'archived'
);

CREATE TABLE IF NOT EXISTS consent_log (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES leads(session_id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'landing'
);

CREATE INDEX IF NOT EXISTS idx_verifications_session ON verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_verifications_completed ON verifications(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);
CREATE INDEX IF NOT EXISTS idx_documents_verification ON documents(verification_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
