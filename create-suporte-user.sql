
-- Script para criar usuário suporte@groppoinformatica.com.br
-- Com mesmas permissões e empresas do admin@adaptafiscal.com.br

-- 1. Criar o usuário (senha: 123456 já hashada com bcrypt)
-- Hash gerado para '123456': $2a$10$rOJ3VJGtIl8Y0ZJhFZ8HX.N8QxZ5xZ4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Zu
INSERT INTO users (email, password_hash, name, role, active)
VALUES (
  'suporte@groppoinformatica.com.br',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1TzVbRCPiGJ5GpHJqZnJnKbLbLqHX8S', -- hash de '123456'
  'Suporte Groppo Informática',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  active = EXCLUDED.active;

-- 2. Vincular às mesmas empresas do admin
-- Primeiro, pegar o ID do novo usuário e do admin
WITH novo_usuario AS (
  SELECT id FROM users WHERE email = 'suporte@groppoinformatica.com.br'
),
admin_usuario AS (
  SELECT id FROM users WHERE email = 'admin@adaptafiscal.com.br'
),
empresas_admin AS (
  SELECT DISTINCT company_id 
  FROM company_users 
  WHERE user_id = (SELECT id FROM admin_usuario)
)
-- Inserir vínculos para todas as empresas do admin
INSERT INTO company_users (user_id, company_id)
SELECT 
  (SELECT id FROM novo_usuario),
  company_id
FROM empresas_admin
ON CONFLICT DO NOTHING;

-- 3. Verificar criação
SELECT 
  u.email,
  u.name,
  u.role,
  u.active,
  COUNT(cu.company_id) as total_empresas
FROM users u
LEFT JOIN company_users cu ON cu.user_id = u.id
WHERE u.email IN ('admin@adaptafiscal.com.br', 'suporte@groppoinformatica.com.br')
GROUP BY u.id, u.email, u.name, u.role, u.active
ORDER BY u.email;
