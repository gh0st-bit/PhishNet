-- Check test0user@mail.com role assignment
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.is_admin,
  u.organization_id,
  r.name as role_name
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'test0user@mail.com';
