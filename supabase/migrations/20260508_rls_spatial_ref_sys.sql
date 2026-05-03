-- Enable RLS on PostGIS system table to prevent exposure via PostgREST.
-- No policies are created intentionally: deny-all by default.
-- The table is used internally by the database engine and does not need
-- to be accessible through the REST API.

ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
