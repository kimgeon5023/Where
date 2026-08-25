-- Where 회원 목록: VS Code PostgreSQL 확장에서 실행하세요.
SELECT
  id,
  username,
  name,
  source_site,
  provider,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- 사이트별 회원 수
SELECT
  source_site,
  COUNT(*) AS user_count
FROM public.users
GROUP BY source_site
ORDER BY source_site;
