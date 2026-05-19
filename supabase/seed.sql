-- Seed Data for Development

-- Insert a sample tenant
INSERT INTO tenants (id, name, slug) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Partido Exemplo', 'partido-exemplo');

-- Note: Users need to be created through Supabase Auth first
-- Then their profile is inserted into the users table

-- Sample survey (requires a valid user_id)
-- INSERT INTO surveys (tenant_id, title, description, status, created_by) VALUES
--   ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pesquisa de Intenção de Voto', 'Pesquisa sobre intenção de voto para as eleições 2024', 'active', '<user_id>');
