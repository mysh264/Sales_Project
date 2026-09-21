CREATE FUNCTION _redact_audit_secrets(input_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_value IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(input_value)
    WHEN 'object' THEN
      RETURN COALESCE(
        (
          SELECT jsonb_object_agg(
            item.key,
            CASE
              WHEN regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') LIKE '%password%'
                OR regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') LIKE '%secret%'
                OR regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') LIKE '%recoverycode%'
                OR regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') LIKE '%apikey%'
                OR regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') LIKE '%privatekey%'
                OR regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') LIKE '%credential%'
                OR regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') ~ '(token|tokenhash)$'
              THEN '"[REDACTED]"'::jsonb
              ELSE _redact_audit_secrets(item.value)
            END
          )
          FROM jsonb_each(input_value) AS item(key, value)
        ),
        '{}'::jsonb
      );
    WHEN 'array' THEN
      RETURN COALESCE(
        (
          SELECT jsonb_agg(_redact_audit_secrets(item.value) ORDER BY item.ordinality)
          FROM jsonb_array_elements(input_value) WITH ORDINALITY AS item(value, ordinality)
        ),
        '[]'::jsonb
      );
    ELSE
      RETURN input_value;
  END CASE;
END;
$$;

UPDATE "AuditLog"
SET
  "oldValue" = _redact_audit_secrets("oldValue"),
  "newValue" = _redact_audit_secrets("newValue");

DROP FUNCTION _redact_audit_secrets(jsonb);
