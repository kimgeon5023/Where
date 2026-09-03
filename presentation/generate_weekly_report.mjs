import pptxgen from 'pptxgenjs'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(import.meta.dirname, '2026-09-03-갈래말래-주간개발발표.pptx')
const downloadOutput = resolve(root, 'public', 'downloads', basename(output))
const asset = (name) => resolve(root, name)
const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = '갈래말래 개발팀'
pptx.subject = '갈래말래 주간 개발 발표'
pptx.title = '갈래말래 주간 개발 발표'
pptx.lang = 'ko-KR'
pptx.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic', lang: 'ko-KR' }

const C = { navy: '17243A', blue: '2C7BE5', mint: '22A06B', bg: 'F5F8FC', white: 'FFFFFF', text: '26354B', muted: '64748B', line: 'DCE5F0', paleBlue: 'EAF3FF', paleMint: 'E9F8F0', orange: 'F59E0B' }
const FONT = 'Malgun Gothic'
function box(s, x, y, w, h, fill = C.white, line = fill, radius = true) {
  s.addShape(radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: line, transparency: line === fill ? 100 : 0 } })
}
function tx(s, value, x, y, w, h, options = {}) {
  s.addText(value, { x, y, w, h, fontFace: FONT, fontSize: 16, color: C.text, margin: 0, breakLine: false, fit: 'shrink', valign: 'mid', ...options })
}
function head(s, number, title, subtitle) {
  tx(s, number, 0.7, 0.46, 2.2, 0.22, { fontSize: 9, bold: true, color: C.blue, charSpacing: 1.1 })
  tx(s, title, 0.7, 0.8, 11.8, 0.45, { fontSize: 25, bold: true, color: C.navy })
  tx(s, subtitle, 0.7, 1.35, 11.7, 0.3, { fontSize: 11, color: C.muted })
}
function footer(s, n) {
  s.addShape(pptx.ShapeType.line, { x: 0.7, y: 7.04, w: 11.95, h: 0, line: { color: C.line, width: 0.7 } })
  tx(s, '갈래말래 | 주간 개발 발표', 0.7, 7.13, 3.2, 0.14, { fontSize: 7.5, color: C.muted })
  tx(s, `${n} / 8`, 12.05, 7.13, 0.6, 0.14, { fontSize: 7.5, color: C.muted, align: 'right' })
}
function card(s, x, y, w, h, title, body, color = C.blue) {
  box(s, x, y, w, h, C.white, C.line); box(s, x, y, 0.08, h, color, color, false)
  tx(s, title, x + 0.28, y + 0.22, w - 0.5, 0.28, { fontSize: 14, bold: true, color: C.navy })
  tx(s, body, x + 0.28, y + 0.68, w - 0.5, h - 0.9, { fontSize: 11, color: C.muted, breakLine: true, valign: 'top' })
}
function arrow(s, x1, y1, x2, y2, color = C.blue) {
  s.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width: 1.5, endArrowType: 'triangle' } })
}

// 1
{
  const s = pptx.addSlide(); s.background = { color: C.navy }
  box(s, 0.75, 0.72, 0.48, 0.48, C.blue); tx(s, '갈', 0.75, 0.83, 0.48, 0.16, { fontSize: 12, bold: true, color: C.white, align: 'center' })
  tx(s, '갈래말래', 1.42, 0.82, 1.5, 0.2, { fontSize: 14, bold: true, color: C.white })
  tx(s, 'WEEKLY REPORT', 0.76, 2.05, 3.2, 0.2, { fontSize: 10, bold: true, color: '96C2FF', charSpacing: 1.7 })
  tx(s, '여행 추천을\n내 여행 코스로 만드는 서비스', 0.75, 2.5, 7.8, 1.25, { fontSize: 31, bold: true, color: C.white, breakLine: true, valign: 'mid' })
  tx(s, '이번 주 개발 내용 | 2026. 09. 03', 0.78, 4.12, 4.8, 0.24, { fontSize: 12, color: 'C9DBF8' })
  box(s, 9.45, 1.75, 2.8, 3.5, '254C85'); tx(s, '추천\n→ 선택\n→ 나만의 코스', 9.75, 2.45, 2.2, 1.35, { fontSize: 20, bold: true, color: C.white, breakLine: true, align: 'center', valign: 'mid' })
  tx(s, '사진 리뷰도 함께', 9.75, 4.55, 2.2, 0.2, { fontSize: 10, color: 'BFD8FF', align: 'center' })
}
// 2
{
  const s = pptx.addSlide(); s.background = { color: C.bg }
  head(s, '01  서비스 소개', '갈래말래는 어떤 서비스인가요?', '서울 여행 장소를 추천받고, 마음에 드는 곳만 골라 나만의 여행 코스를 만드는 웹 서비스입니다.')
  box(s, 0.7, 1.95, 7.55, 4.75, C.white, C.line)
  if (existsSync(asset('presentation-home.png'))) s.addImage({ path: asset('presentation-home.png'), x: 0.86, y: 2.11, w: 7.22, h: 4.4 })
  card(s, 8.58, 2.04, 4.02, 1.16, '1. 장소 추천', '지역, 날짜, 누구와 가는지에 맞춰\n여행 장소를 보여줍니다.', C.blue)
  card(s, 8.58, 3.53, 4.02, 1.16, '2. 코스 만들기', '마음에 드는 장소를 추가하고\n순서와 설명을 직접 바꿉니다.', C.mint)
  card(s, 8.58, 5.02, 4.02, 1.16, '3. 경험 남기기', '사진과 함께 리뷰를 쓰고\n내가 쓴 리뷰도 관리합니다.', C.orange); footer(s, 2)
}
// 3
{
  const s = pptx.addSlide(); s.background = { color: C.bg }
  head(s, '02  지난주 작업', '서비스가 기본적으로 동작하는 뼈대를 만들었습니다', '회원별 정보와 여행 데이터를 저장하고, 실제 인터넷에서 사용할 수 있도록 배포했습니다.')
  card(s, 0.75, 2.0, 3.75, 3.95, '로그인한 사람별 데이터', '• 찜한 장소를 사람마다 따로 저장\n• 여행 코스도 내 계정에 저장\n• 내가 쓴 리뷰만 수정·삭제 가능', C.blue)
  card(s, 4.79, 2.0, 3.75, 3.95, '추천 장소 화면', '• 지도에서 장소 위치 확인\n• 장소별 사진·설명·리뷰 표시\n• 원하는 장소를 찜하기', C.mint)
  card(s, 8.83, 2.0, 3.75, 3.95, '웹사이트 공개', '• Vercel: 웹 화면을 올리는 곳\n• Render: 요청을 처리하는 서버\n• PostgreSQL: 데이터를 저장하는 곳', C.orange)
  tx(s, '한 줄 정리: “추천만 보는 화면”에서 “직접 사용할 수 있는 서비스”로 발전했습니다.', 0.8, 6.34, 11.7, 0.28, { fontSize: 12, bold: true, color: C.navy, align: 'center' }); footer(s, 3)
}
// 4
{
  const s = pptx.addSlide(); s.background = { color: C.bg }
  head(s, '03  이번 주 작업', '추천 장소로 나만의 여행 코스를 직접 만들 수 있습니다', '자동으로 추천만 받는 것이 아니라, 사용자가 원하는 여행 계획으로 바꿀 수 있게 했습니다.')
  const steps = [['1', '직접 짜기 누르기', '추천 장소 카드 위에서\n코스 편집을 시작합니다.'], ['2', '장소 추가·제거', '원하는 장소는 더하고\n필요 없는 장소는 뺍니다.'], ['3', '순서·설명 바꾸기', '방문 순서와 코스 설명을\n내 계획에 맞게 고칩니다.'], ['4', '완료 후 저장', '완료를 누르면 저장되고\n일반 보기 화면으로 돌아갑니다.']]
  steps.forEach(([n, title, body], i) => {
    const x = 0.76 + i * 3.12; box(s, x, 2.35, 2.54, 2.7, C.white, C.line); box(s, x + 0.26, 2.59, 0.42, 0.42, i === 3 ? C.mint : C.blue)
    tx(s, n, x + 0.26, 2.7, 0.42, 0.12, { fontSize: 10, bold: true, color: C.white, align: 'center' }); tx(s, title, x + 0.26, 3.3, 2.0, 0.25, { fontSize: 13, bold: true, color: C.navy })
    tx(s, body, x + 0.26, 3.74, 2.0, 0.62, { fontSize: 10.4, color: C.muted, breakLine: true, valign: 'mid' }); if (i < 3) arrow(s, x + 2.6, 3.7, x + 3.0, 3.7, C.mint)
  })
  box(s, 1.3, 5.6, 10.7, 0.58, C.paleMint); tx(s, '수정 중에는 “완료”와 “취소” 버튼을 보여줘서, 저장 여부를 쉽게 알 수 있습니다.', 1.55, 5.78, 10.2, 0.18, { fontSize: 11.5, bold: true, color: '14734B', align: 'center' }); footer(s, 4)
}
// 5
{
  const s = pptx.addSlide(); s.background = { color: C.bg }
  head(s, '04  이번 주 작업', '사진 리뷰는 자세히 보고, 추천 카드는 가볍게 봅니다', '리뷰가 길어도 장소 카드가 너무 커지지 않도록 화면을 나누었습니다.')
  card(s, 0.75, 2.05, 3.65, 3.85, '리뷰 작성', '• 별점, 글, 사진을 함께 올림\n• 올린 사진은 리뷰와 같이 저장\n• 작성 후에도 내 리뷰에서 수정·삭제 가능', C.orange)
  card(s, 4.82, 2.05, 3.65, 3.85, '추천 카드에서는 미리보기', '• 긴 리뷰는 몇 줄만 보여줌\n• 카드 높이를 일정하게 유지\n• PC에서는 카드 2개씩 보기', C.blue)
  card(s, 8.89, 2.05, 3.65, 3.85, '전체 리뷰는 따로 보기', '• 리뷰를 누르면 전체 글 확인\n• 긴 글과 사진은 스크롤해서 보기\n• 휴대폰 화면도 너무 길어지지 않음', C.mint)
  box(s, 1.22, 6.2, 10.9, 0.42, C.paleBlue); tx(s, '핵심: 목록은 빠르게 보고, 궁금한 리뷰만 눌러서 자세히 봅니다.', 1.45, 6.32, 10.45, 0.15, { fontSize: 11, bold: true, color: C.blue, align: 'center' }); footer(s, 5)
}
// 6
{
  const s = pptx.addSlide(); s.background = { color: C.bg }
  head(s, '05  이번 주 작업', '현재 위치를 이용해 장소까지의 거리를 바로 보여줍니다', '휴대폰이나 컴퓨터의 GPS 권한을 허용하면, 내 위치가 바뀔 때 거리도 함께 바뀝니다.')
  const gps = [['내 휴대폰 GPS', '현재 위치\n위치가 바뀌면 자동 갱신', C.blue], ['거리 계산', '현재 위치와 장소 좌표를 비교\n예: 1.24km', C.mint], ['여행 코스 카드', '각 장소까지\n실시간 거리 표시', C.orange]]
  gps.forEach(([title, body, color], i) => { const x = 0.85 + i * 4.05; box(s, x, 2.15, 3.1, 3.55, C.white, C.line); box(s, x + 1.15, 2.63, 0.8, 0.8, i === 1 ? C.paleMint : C.paleBlue); tx(s, String(i + 1), x + 1.15, 2.91, 0.8, 0.18, { fontSize: 16, bold: true, color, align: 'center' }); tx(s, title, x + 0.25, 3.75, 2.6, 0.25, { fontSize: 15, bold: true, color: C.navy, align: 'center' }); tx(s, body, x + 0.32, 4.28, 2.45, 0.52, { fontSize: 11, color: C.muted, breakLine: true, align: 'center', valign: 'mid' }); if (i < 2) arrow(s, x + 3.18, 3.85, x + 3.93, 3.85, color) })
  tx(s, '※ 지도 위 두 지점 사이의 직선거리 기준입니다.', 0.9, 6.15, 11.5, 0.2, { fontSize: 10.5, color: C.muted, align: 'center' }); footer(s, 6)
}
// 7
{
  const s = pptx.addSlide(); s.background = { color: C.bg }
  head(s, '06  문제 해결', '사용 중 불편했던 부분을 고쳤습니다', '오류가 나도 화면이 갑자기 비거나, 글 때문에 카드가 끝없이 길어지지 않게 했습니다.')
  const rows = [['추천 장소가 안 보임', '서버가 잠깐 늦게 켜질 수 있음', '기존 목록을 유지하고 자동으로 다시 연결'], ['리뷰 때문에 카드가 커짐', '긴 리뷰 글이 카드 안에 모두 표시됨', '미리보기만 표시하고 전체 글은 따로 보기'], ['프로필 메뉴가 가려짐', '다른 화면 요소가 메뉴 위에 표시됨', '메뉴가 항상 위에 보이도록 화면 순서 수정']]
  rows.forEach(([problem, reason, solution], i) => { const y = 2.02 + i * 1.36; box(s, 0.82, y, 11.7, 1.03, C.white, C.line); tx(s, problem, 1.12, y + 0.2, 2.45, 0.2, { fontSize: 12, bold: true, color: C.navy }); tx(s, reason, 4.05, y + 0.2, 3.05, 0.2, { fontSize: 10.4, color: C.muted }); tx(s, solution, 8.05, y + 0.2, 3.95, 0.2, { fontSize: 10.8, bold: true, color: C.mint }); tx(s, '불편했던 점', 1.12, y + 0.61, 0.7, 0.13, { fontSize: 7.5, color: C.muted }); tx(s, '이유', 4.05, y + 0.61, 0.35, 0.13, { fontSize: 7.5, color: C.muted }); tx(s, '해결 방법', 8.05, y + 0.61, 0.55, 0.13, { fontSize: 7.5, color: C.muted }) })
  box(s, 1.05, 6.32, 11.15, 0.35, C.navy); tx(s, '확인 완료: 웹사이트 화면 빌드 성공 · 서버 상태 확인 주소에서 정상 응답', 1.3, 6.42, 10.65, 0.14, { fontSize: 10, bold: true, color: C.white, align: 'center' }); footer(s, 7)
}
// 8
{
  const s = pptx.addSlide(); s.background = { color: C.navy }
  tx(s, '07  서비스 구조와 다음 목표', 0.75, 0.66, 4.0, 0.2, { fontSize: 10, bold: true, color: '9CC5FF' })
  tx(s, '화면, 서버, 데이터 저장소가\n서로 역할을 나눠서 동작합니다', 0.75, 1.1, 8.0, 0.78, { fontSize: 25, bold: true, color: C.white, breakLine: true, valign: 'mid' })
  const nodes = [['사용자', '휴대폰·컴퓨터에서\n여행 장소를 확인'], ['Vercel', '웹 화면을\n보여주는 곳'], ['Render', '요청을 처리하는\n서버'], ['PostgreSQL', '리뷰·코스를\n저장하는 곳']]
  nodes.forEach(([title, body], i) => { const x = 0.75 + i * 3.08; box(s, x, 3.05, 2.4, 1.5, i === 2 ? '1E7258' : '284260'); tx(s, title, x + 0.2, 3.34, 2.0, 0.22, { fontSize: 14, bold: true, color: C.white, align: 'center' }); tx(s, body, x + 0.2, 3.78, 2.0, 0.4, { fontSize: 9.5, color: 'CDE0FA', breakLine: true, align: 'center', valign: 'mid' }); if (i < 3) arrow(s, x + 2.48, 3.8, x + 2.98, 3.8, '8FC1FF') })
  box(s, 0.75, 5.36, 11.78, 0.82, '213A5A'); tx(s, '다음 목표: 실제 사용자가 코스를 만들고 리뷰를 쓸 때 불편한 점을 확인해 계속 개선하기', 1.05, 5.63, 11.18, 0.24, { fontSize: 14, bold: true, color: C.white, align: 'center' }); tx(s, '감사합니다', 0.76, 6.58, 1.4, 0.18, { fontSize: 10, color: 'BBD6F8' })
}

if (!existsSync(dirname(output))) mkdirSync(dirname(output), { recursive: true })
await pptx.writeFile({ fileName: output })
if (!existsSync(dirname(downloadOutput))) mkdirSync(dirname(downloadOutput), { recursive: true })
copyFileSync(output, downloadOutput)
console.log(`Created: ${output}`)
console.log(`Download copy: ${downloadOutput}`)
