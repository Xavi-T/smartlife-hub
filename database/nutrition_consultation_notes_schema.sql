-- ===========================================
-- SmartLife Hub - Nutrition Consultation Notes
-- Note tư vấn nhanh cho bác sĩ dinh dưỡng
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS nutrition_consultation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES nutrition_clients(id) ON DELETE SET NULL,
  full_name VARCHAR(255),
  phone VARCHAR(30),
  gender VARCHAR(20)
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  birth_date DATE,
  age_years INTEGER CHECK (age_years IS NULL OR age_years >= 0),
  height_cm DECIMAL(6, 2) CHECK (height_cm IS NULL OR height_cm > 0),
  weight_kg DECIMAL(6, 2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  activity_level VARCHAR(30)
    CHECK (
      activity_level IS NULL OR
      activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')
    ),
  goal VARCHAR(30)
    CHECK (
      goal IS NULL OR
      goal IN ('lose_weight', 'maintain', 'gain_weight', 'improve_health')
    ),
  medical_notes TEXT,
  allergies TEXT,
  current_diet TEXT,
  quick_note TEXT NOT NULL DEFAULT '',
  recommendation TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'converted', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_notes_client_id
  ON nutrition_consultation_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_notes_phone
  ON nutrition_consultation_notes(phone);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_notes_status
  ON nutrition_consultation_notes(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_notes_created_at
  ON nutrition_consultation_notes(created_at DESC);

CREATE OR REPLACE FUNCTION set_nutrition_consultation_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nutrition_consultation_notes_updated_at
  ON nutrition_consultation_notes;
CREATE TRIGGER trigger_nutrition_consultation_notes_updated_at
  BEFORE UPDATE ON nutrition_consultation_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_nutrition_consultation_notes_updated_at();

ALTER TABLE nutrition_consultation_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage nutrition consultation notes"
  ON nutrition_consultation_notes;
CREATE POLICY "Authenticated manage nutrition consultation notes"
  ON nutrition_consultation_notes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE
  ON nutrition_consultation_notes TO authenticated;
