# Orbit Keepsake 인쇄 접수 관리자 페이지

## 구성
- \`index.html\` — 포토카드 꾸미기와 PNG 저장, 인쇄 접수 버튼.
- \`admin.html\` — 친구 전용 로그인, 주문 목록, 이미지 미리보기·다운로드·상태 관리, 인쇄 후 삭제.
- \`print-config.js\` — 공개해도 되는 Supabase 프로젝트 URL과 **publishable/anon** 키만.
- \`supabase-print-schema.sql\` — 비공개 저장소, 인쇄 주문, 회원 권한 및 업로드 검증/제한.
- 참여자 이미지는 GitHub 저장소에 올리지 않음. 공개 Storage 버킷 사용 금지.

## 실제 인쇄 접수 활성화 방법
1. Supabase 프로젝트를 만들고 SQL Editor에서 \`supabase-print-schema.sql\` 전체를 실행.
2. Authentication > Providers에서 **Anonymous Sign-Ins** 및 **Email**을 활성화.
3. Authentication > URL Configuration에서 \`https://ddogy1212.github.io/ast/admin.html\` 리다이렉트 주소 등록.
4. 친구의 실제 이메일로 다음 SQL 실행:
   \`insert into public.print_admin_emails(email) values ('printer@example.com') on conflict do nothing;\`
   반드시 친구 이메일 주소로 바꾸세요. 이 이메일로 로그인한 사람만 주문 목록과 비공개 사진을 볼 수 있습니다.
5. Supabase Settings > API의 **Project URL** 및 **publishable (or legacy anon) key**를 \`print-config.js\`에 입력 후 GitHub에 배포. 절대로 service_role/secret 키를 넣지 마세요.
6. 관리자 페이지에서 친구 이메일 입력 → 받은 일회용 로그인 링크 클릭 → 인쇄 카드 확인.
7. 사이트에서 PNG 저장과 별도로 **인쇄 접수** 버튼 클릭 → 닉네임 입력 및 사진 전송 동의 → 서버에서 주문 코드가 반환되는지 확인.

## 보안 및 운영
- 인쇄 접수 완료 문구는 Storage에 PNG가 업로드되고 주문 RPC가 성공한 뒤에만 표시.
- 주문 목록과 이미지 다운로드는 허가된 관리자 이메일만 접근 가능하며, 이미지 링크는 단기간 유효한 서명 URL로 발급.
- 관리자 화면은 인증 과정에서 오류가 나면 주문을 표시하지 않습니다.
- 참여자는 사진이 인쇄 담당자에게 전송된다는 데 명시적으로 동의해야 합니다.
- 인쇄 완료 후 관리자가 **파일 및 주문 삭제**를 실행할 수 있습니다.
- 공개 익명 접수는 악용될 수 있습니다. Supabase Auth CAPTCHA(예: Turnstile), 사용량 경고, Storage 한도 및 로그 확인을 추가해 운영하십시오.
- 학급 행사에서 다수 접수를 받기 전에 다른 기기로 관리자 로그인, 파일 전송, 다운로드, 삭제를 반드시 검증하세요.

Supabase official docs:
https://supabase.com/docs/guides/auth/auth-anonymous
https://supabase.com/docs/guides/storage/security/access-control
https://supabase.com/docs/guides/auth/auth-email-passwordless
