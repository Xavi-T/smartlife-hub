-- ===========================================
-- Bảng Audit Logs
-- ===========================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  actor VARCHAR(100) DEFAULT 'Admin',
  action VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read access to audit_logs" ON audit_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON audit_logs TO anon, authenticated;

-- ===========================================
-- Function: Log Audit Event
-- ===========================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_actor VARCHAR,
  p_action VARCHAR,
  p_description TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    event_type,
    entity_type,
    entity_id,
    actor,
    action,
    description,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor,
    p_action,
    p_description,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION log_audit_event TO anon, authenticated;

-- ===========================================
-- Comments for documentation
-- ===========================================

COMMENT ON TABLE audit_logs IS 'Ghi lại tất cả các thay đổi quan trọng trong hệ thống';
COMMENT ON COLUMN audit_logs.event_type IS 'Loại sự kiện: product.updated, order.status_changed, stock.updated, etc.';
COMMENT ON COLUMN audit_logs.entity_type IS 'Loại đối tượng: product, order, customer, etc.';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID của đối tượng bị thay đổi';
COMMENT ON COLUMN audit_logs.actor IS 'Người thực hiện: Admin, System, Customer Name';
COMMENT ON COLUMN audit_logs.action IS 'Hành động: create, update, delete, etc.';
COMMENT ON COLUMN audit_logs.description IS 'Mô tả chi tiết sự kiện';
COMMENT ON COLUMN audit_logs.old_values IS 'Giá trị cũ (JSON)';
COMMENT ON COLUMN audit_logs.new_values IS 'Giá trị mới (JSON)';
COMMENT ON COLUMN audit_logs.metadata IS 'Dữ liệu bổ sung (JSON)';
