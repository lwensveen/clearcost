INSERT INTO "source_registry" (
  "key",
  "dataset",
  "source_type",
  "base_url",
  "download_url_template",
  "schedule_hint",
  "expected_format",
  "auth_strategy",
  "sla_max_age_hours",
  "notes",
  "last_verified_at"
)
VALUES
  (
    'notices.cn.mof.list',
    'notices',
    'html',
    'https://www.mof.gov.cn',
    'https://www.mof.gov.cn/zhengwuxinxi/zhengcefabu/',
    'weekly',
    'html',
    'none',
    168,
    'CN Ministry of Finance policy release list page used as default seed for notices crawl (MOF).',
    NOW()
  ),
  (
    'notices.cn.gacc.list',
    'notices',
    'html',
    'http://www.customs.gov.cn',
    'http://www.customs.gov.cn/customs/302249/302266/302267/index.html',
    'weekly',
    'html',
    'none',
    168,
    'CN General Administration of Customs announcements list page used as default seed for notices crawl (GACC).',
    NOW()
  ),
  (
    'notices.cn.mofcom.list',
    'notices',
    'html',
    'http://www.mofcom.gov.cn',
    'http://www.mofcom.gov.cn/article/ae/',
    'weekly',
    'html',
    'none',
    168,
    'CN Ministry of Commerce announcements list page used as default seed for notices crawl (MOFCOM).',
    NOW()
  )
ON CONFLICT ("key") DO NOTHING;
