# Notion-Teams-Workflow-Server

## 🛠️ 사용 기술

- Node.js (Express 기반)
- OpenAI API
- Notion API
- Microsoft Teams Webhook
- JavaScript (ES6+)

## 🚀 실행 방법

1. **환경 변수 설정**
   - `.env` 파일에 아래와 같이 API 키와 Webhook 정보를 입력하세요.
     ```env
     NOTION_API_KEY=your_notion_api_key
     OPENAI_API_KEY=your_openai_api_key
     TEAMS_WEBHOOK_URL=your_teams_webhook_url
     TEAMS_WEBHOOK_SECRET=your_teams_webhook_secret
     ```
2. **의존성 설치**
   ```bash
   npm install
   ```
3. **서버 실행**
   ```bash
   node src/index.js
   ```
   또는
   ```bash
   npm start
   ```

## 📁 폴더 구조

```
src/
├── config/                # 외부 서비스 및 환경설정
│   ├── notion.config.js
│   ├── openai.config.js
│   └── teams.config.js
├── controllers/           # 요청 처리 및 비즈니스 로직 연결
│   ├── notion.controller.js
│   └── teams.controller.js
├── routes/                # API 라우팅
│   ├── notion.routes.js
│   └── teams.routes.js
├── services/              # 핵심 비즈니스 로직
│   ├── notion.service.js
│   └── teams.service.js
├── utils/                 # 유틸리티 함수
│   ├── codegen.util.js
│   └── dateFolder.util.js
├── poc/                   # 자동 생성 코드/JSON 결과물 (날짜별 폴더)
├── app.js                 # Express 앱 설정
├── index.js               # 서버 실행 진입점
└── ...
```

## ✨ 핵심 기능

- **Teams Webhook 연동**: Teams에서 수락 메시지 수신 및 인증
- **Notion 페이지 파싱**: Notion API로 페이지 본문/제목 추출
- **OpenAI 연동**: Notion 문서를 LLM으로 분석해 JSON 변환
- **자동 코드 생성**: 변환된 JSON을 바탕으로 JS 코드 자동 생성 및 파일 저장
- **폴더/파일 관리**: 날짜+번호 기반으로 결과물 폴더/파일 자동 생성
- **중복 메시지 방지**: 동일 Teams 메시지 중복 처리 방지
- **에러 및 인증 처리**: Webhook HMAC 검증, 예외 상황 로깅
