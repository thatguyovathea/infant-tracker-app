-- RLS Isolation Tests
-- Verifies cross-family data isolation via Supabase RLS policies
-- Run: supabase db query --linked -f scripts/test_rls_isolation.sql

-- User A: 6f011a10 in family 6d3ba4f9
-- User B: bbe23e65 in family 451a44c6

DROP TABLE IF EXISTS _rls_test_results;
CREATE TABLE _rls_test_results (test_name TEXT, passed BOOLEAN, detail TEXT);

-- Create test data as service role
INSERT INTO babies (id, family_id, name, date_of_birth)
VALUES ('aaaaaaaa-0000-4000-a000-000000000001', '6d3ba4f9-a7a0-4f75-9a29-4d969944282e', '__rls_test_a', '2025-01-01')
ON CONFLICT (id) DO NOTHING;
INSERT INTO babies (id, family_id, name, date_of_birth)
VALUES ('bbbbbbbb-0000-4000-b000-000000000001', '451a44c6-b4e9-474c-bcb2-8ecc9df8b378', '__rls_test_b', '2025-01-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO feeding_logs (id, baby_id, family_id, logged_by, type, started_at)
VALUES ('aaaaaaaa-0000-4000-a000-000000000002', 'aaaaaaaa-0000-4000-a000-000000000001', '6d3ba4f9-a7a0-4f75-9a29-4d969944282e', '6f011a10-4e80-428f-9607-6ee53b34c0a5', 'breast', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO feeding_logs (id, baby_id, family_id, logged_by, type, started_at)
VALUES ('bbbbbbbb-0000-4000-b000-000000000002', 'bbbbbbbb-0000-4000-b000-000000000001', '451a44c6-b4e9-474c-bcb2-8ecc9df8b378', 'bbe23e65-cf7d-483b-ac18-a061438b54be', 'breast', now())
ON CONFLICT (id) DO NOTHING;

-- ===== AS USER A (family 6d3ba4f9) =====
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "6f011a10-4e80-428f-9607-6ee53b34c0a5", "role": "authenticated"}';

-- T1: User A blocked from Family B babies
INSERT INTO _rls_test_results SELECT 'T1: UserA blocked from FamilyB babies', count(*)=0, CASE WHEN count(*)=0 THEN 'blocked' ELSE 'LEAKED' END FROM babies WHERE id = 'bbbbbbbb-0000-4000-b000-000000000001';

-- T2: User A blocked from Family B feeds
INSERT INTO _rls_test_results SELECT 'T2: UserA blocked from FamilyB feeds', count(*)=0, CASE WHEN count(*)=0 THEN 'blocked' ELSE 'LEAKED' END FROM feeding_logs WHERE id = 'bbbbbbbb-0000-4000-b000-000000000002';

-- T3: User A sees own babies
INSERT INTO _rls_test_results SELECT 'T3: UserA sees own babies', count(*)=1, CASE WHEN count(*)=1 THEN 'ok' ELSE 'MISSING' END FROM babies WHERE id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- T4: User A sees own feeds
INSERT INTO _rls_test_results SELECT 'T4: UserA sees own feeds', count(*)=1, CASE WHEN count(*)=1 THEN 'ok' ELSE 'MISSING' END FROM feeding_logs WHERE id = 'aaaaaaaa-0000-4000-a000-000000000002';

-- ===== AS USER B (family 451a44c6) =====
RESET role;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "bbe23e65-cf7d-483b-ac18-a061438b54be", "role": "authenticated"}';

-- T5: User B blocked from Family A babies
INSERT INTO _rls_test_results SELECT 'T5: UserB blocked from FamilyA babies', count(*)=0, CASE WHEN count(*)=0 THEN 'blocked' ELSE 'LEAKED' END FROM babies WHERE id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- T6: User B blocked from Family A feeds
INSERT INTO _rls_test_results SELECT 'T6: UserB blocked from FamilyA feeds', count(*)=0, CASE WHEN count(*)=0 THEN 'blocked' ELSE 'LEAKED' END FROM feeding_logs WHERE id = 'aaaaaaaa-0000-4000-a000-000000000002';

-- T7: User B sees own babies
INSERT INTO _rls_test_results SELECT 'T7: UserB sees own babies', count(*)=1, CASE WHEN count(*)=1 THEN 'ok' ELSE 'MISSING' END FROM babies WHERE id = 'bbbbbbbb-0000-4000-b000-000000000001';

-- T8: User B sees own feeds
INSERT INTO _rls_test_results SELECT 'T8: UserB sees own feeds', count(*)=1, CASE WHEN count(*)=1 THEN 'ok' ELSE 'MISSING' END FROM feeding_logs WHERE id = 'bbbbbbbb-0000-4000-b000-000000000002';

-- CLEANUP
RESET role;
DELETE FROM feeding_logs WHERE id IN ('aaaaaaaa-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-b000-000000000002');
DELETE FROM babies WHERE id IN ('aaaaaaaa-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-b000-000000000001');

-- RESULTS
SELECT CASE WHEN passed THEN '✓' ELSE '✗' END AS s, test_name, detail FROM _rls_test_results ORDER BY test_name;
