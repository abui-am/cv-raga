-- Preserve evidence and original documents while retiring duplicate career facts.
ALTER TABLE "Evidence" ADD COLUMN "careerEntryId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "consolidatedAt" TIMESTAMP(3);
CREATE INDEX "Evidence_careerEntryId_idx" ON "Evidence"("careerEntryId");

-- Only exact facts already confirmed in career history are consolidated. The
-- original evidence rows remain available for provenance and historical CVs.
WITH facts AS (
  SELECT jsonb_array_elements_text(role->'bullets') AS text
  FROM "Profile", jsonb_array_elements(content->'experience') AS role
  UNION ALL
  SELECT jsonb_array_elements_text(project->'bullets')
  FROM "Profile", jsonb_array_elements(content->'projects') AS project
  UNION ALL
  SELECT jsonb_array_elements_text(content->'certifications') FROM "Profile"
  UNION ALL
  SELECT concat_ws(' | ', education->>'institution', education->>'period')
  FROM "Profile", jsonb_array_elements(content->'education') AS education
  UNION ALL
  SELECT concat_ws(E'\n', NULLIF(project->>'detail', ''),
    (SELECT string_agg(bullet, E'\n') FROM jsonb_array_elements_text(project->'bullets') AS bullet))
  FROM "Profile", jsonb_array_elements(content->'projects') AS project
  UNION ALL
  SELECT concat_ws(E'\n',
    concat_ws(' | ', NULLIF(concat_ws(' · ', NULLIF(role->>'company', ''),
      NULLIF(role->>'employmentType', ''), NULLIF(role->>'workMode', ''),
      CASE WHEN role->>'workMode' = 'Remote' THEN NULL ELSE NULLIF(role->>'location', '') END), ''),
      NULLIF(role->>'period', '')),
    (SELECT string_agg(bullet, E'\n') FROM jsonb_array_elements_text(role->'bullets') AS bullet))
  FROM "Profile", jsonb_array_elements(content->'experience') AS role
)
UPDATE "Evidence" SET "consolidatedAt" = CURRENT_TIMESTAMP, "revision" = "revision" + 1
WHERE EXISTS (SELECT 1 FROM facts
  WHERE trim(regexp_replace(lower(facts.text), '\s+', ' ', 'g')) <> ''
  AND trim(regexp_replace(lower(facts.text), '\s+', ' ', 'g')) =
      trim(regexp_replace(lower("Evidence".text), '\s+', ' ', 'g')));
