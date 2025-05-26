const axios = require('axios');
const { OpenAI } = require('openai');
const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const { getNotionPageContent } = require('./notion');
const crypto = require('crypto');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 중복 메시지 방지용 Set (10분 유지)
const processedMessageIds = new Set();
function addProcessedMessageId(id, ttlMs = 10 * 60 * 1000) {
  processedMessageIds.add(id);
  setTimeout(() => processedMessageIds.delete(id), ttlMs);
}

async function sendTeamsNotification(pageInfo) {
  const message = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              text: `새로운 문서가 업데이트되었습니다: ${pageInfo.title}`,
            },
            {
              type: 'ActionSet',
              actions: [
                {
                  type: 'Action.Submit',
                  title: '수락',
                  data: {
                    action: 'approve',
                    pageId: pageInfo.id,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  await axios.post(process.env.TEAMS_WEBHOOK_URL, message);
}

// 메시지에서 PageID 추출 함수
function extractPageIdFromMessage(message) {
  // "PageID: "로 시작하는 줄에서 ID 추출
  const match = message.match(/PageID:\s*([a-f0-9\-]+)/i);
  return match ? match[1] : null;
}

function extractPageIdFromSubject(subject) {
  // UUID 패턴 추출
  const match =
    subject &&
    subject.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return match ? match[0] : null;
}

function extractPageIdFromText(text) {
  console.log('Teams Webhook text 원본:', text);
  let plain = text || '';
  plain = plain.replace(/<[^>]+>/g, ' ');
  plain = plain.replace(/&nbsp;/g, ' ');
  plain = plain.replace(/[\r\n]+/g, ' ');
  plain = plain.replace(/\s+/g, ' ');
  console.log('PageID 추출용 변환 결과:', plain);
  const match = plain.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  );
  console.log('PageID 추출 결과:', match ? match[0] : null);
  return match ? match[0] : null;
}

async function convertTextToJson(title, bodyText) {
  console.log('bodyText: ', `${bodyText}`);
  const prompt = `아래는 소프트웨어 기능 명세 문서입니다.\n\n문서 제목: ${title}\n문서 내용:\n${bodyText}\n\n아래 항목별로 개발자가 바로 사용할 수 있도록 핵심 정보를 정리해서 JSON으로 만들어줘. 반드시 JSON만 반환해. 설명이나 다른 텍스트는 필요 없어.\n\n- 개요: 기능의 목적과 전체적인 설명\n- 기능 상세설명: 실제 동작, 처리 로직, 예외 등 상세한 설명\n- 기능 Flow: 주요 처리 흐름을 단계별로 설명 (예: 1. 입력 → 2. 검증 → 3. 처리 → 4. 결과 반환)\n- 예상 input: 문서에서 유추할 수 있는 실제 입력값의 key, 타입, 설명을 최대한 구체적으로 작성 (예: 버튼 기능이면 버튼의 텍스트, 색상 등. API면 파라미터명, 타입 등)\n- 예상 output: 문서에서 유추할 수 있는 실제 출력값의 key, 타입, 설명을 최대한 구체적으로 작성 (예: 화면에 표시될 값, 반환값 등)\n\nJSON 예시:\n{\n  \"개요\": \"...\",\n  \"기능 상세설명\": \"...\",\n  \"기능 Flow\": [\"...\", \"...\"],\n  \"예상 input\": [\n    { \"key\": \"입력값명\", \"type\": \"타입\", \"desc\": \"설명\" }\n  ],\n  \"예상 output\": [\n    { \"key\": \"출력값명\", \"type\": \"타입\", \"desc\": \"설명\" }\n  ]\n}`;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  });
  return JSON.parse(response.choices[0].message.content);
}

async function handleTeamsWebhook(req, res) {
  console.log('Teams Webhook 진입');
  // HMAC 인증
  const sharedSecret = process.env.TEAMS_WEBHOOK_SECRET;
  const bufSecret = Buffer.from(sharedSecret, 'base64');
  const auth = req.headers['authorization'];
  const msgHash =
    'HMAC ' + crypto.createHmac('sha256', bufSecret).update(req.rawBody).digest('base64');
  if (msgHash !== auth) {
    console.error('Teams HMAC 인증 실패:', { msgHash, auth });
    res
      .status(200)
      .json({ type: 'message', text: 'Error: message sender cannot be authenticated.' });
    return;
  }
  // 중복 메시지 방지
  const messageId = req.body.id;
  if (processedMessageIds.has(messageId)) {
    console.log('중복 메시지 감지, 처리 건너뜀:', messageId);
    res.status(200).json({ type: 'message', text: '이미 처리된 요청입니다.' });
    return;
  }
  addProcessedMessageId(messageId);
  // 본문(text)에서 pageId 추출
  const pageId = extractPageIdFromText(req.body.text);
  console.log('Teams 웹훅 호출됨:', req.body);
  if (!pageId) {
    console.error('PageID를 찾을 수 없습니다. (text에서 추출 실패)');
    res.status(200).json({ type: 'message', text: 'PageID를 찾을 수 없습니다.' });
    return;
  }
  // 1. 먼저 Teams에 빠르게 응답
  res.status(200).json({
    type: 'message',
    text: '수락 요청을 받았습니다! 처리 중입니다.',
  });

  // 2. 이후 실제 처리는 비동기로 진행
  try {
    const { title, bodyText } = await getNotionPageContent(pageId);
    const jsonResult = await convertTextToJson(title, bodyText);
    const pocBaseDir = path.join(__dirname, '../poc');
    // 오늘 날짜 폴더명 생성
    const todayFolder = getTodayFolderName(pocBaseDir);
    const pocDir = path.join(pocBaseDir, todayFolder);
    if (!fs.existsSync(pocDir)) fs.mkdirSync(pocDir, { recursive: true });
    // 파일명을 날짜만으로 생성
    const fileName = `${getTodayFileName()}.json`;
    const filePath = path.join(pocDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(jsonResult, null, 2), 'utf-8');
    console.log('JSON 파일 저장 완료:', filePath);
    // JS 초안 코드 생성 및 저장
    const jsFileName = fileName.replace(/\.json$/, '.js');
    const jsFilePath = path.join(pocDir, jsFileName);
    const draftCode = generateDraftJsCode(jsonResult);
    fs.writeFileSync(jsFilePath, draftCode, 'utf-8');
    console.log('JS 초안 코드 저장 완료:', jsFilePath);
  } catch (error) {
    console.error('Teams webhook error:', error);
  }
}

async function convertToJson(pageText) {
  const prompt = `다음 내용을 JSON 형식으로 변환해주세요:\n${pageText}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}

async function saveJsonContent(jsonContent) {
  // 다음 단계에서 구현
  console.log('Saved JSON content:', jsonContent);
}

function getTodayFolderName(baseDir) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const baseName = `${yyyy}${mm}${dd}`;
  let folderName = baseName;
  let idx = 1;
  while (fs.existsSync(path.join(baseDir, folderName))) {
    folderName = `${baseName}-${idx}`;
    idx++;
  }
  return folderName;
}

// 한글 키워드를 영어로 변환하는 간단 번역 테이블
const simpleKoreanToEnglish = {
  버튼: 'button',
  클릭: 'click',
  여부: 'state',
  색상: 'color',
  텍스트: 'text',
  실행: 'run',
  실행중: 'running',
  테스트: 'test',
  페이지: 'page',
  중앙: 'center',
  생성: 'create',
  이벤트: 'event',
  핸들링: 'handle',
  함수: 'function',
  결과: 'result',
  상태: 'state',
  여부: 'state',
  출력: 'output',
  입력: 'input',
};

function koreanToEnglish(str, fallback) {
  // 한글 단어를 영어로 치환, 없으면 fallback
  let result = str;
  Object.entries(simpleKoreanToEnglish).forEach(([ko, en]) => {
    result = result.replace(new RegExp(ko, 'g'), en);
  });
  // 한글이 남아있으면 fallback
  if (/[가-힣]/.test(result)) return fallback;
  return toCamelCase(result);
}

function generateUniqueName(base, used) {
  let name = base;
  let idx = 1;
  while (used.has(name)) {
    name = base + idx;
    idx++;
  }
  used.add(name);
  return name;
}

function generateDraftJsCode(json) {
  // input/output 변수명 생성 (영문 변환, 중복 방지)
  let inputVars = [];
  let outputVars = [];
  const usedVarNames = new Set();
  const usedFuncNames = new Set();
  if (json['예상 input']) {
    inputVars = json['예상 input'].map((i, idx) => {
      let key = koreanToEnglish(i.key || '', `input${idx + 1}`);
      key = generateUniqueName(key, usedVarNames);
      return { ...i, key };
    });
  }
  if (json['예상 output']) {
    outputVars = json['예상 output'].map((o, idx) => {
      let key = koreanToEnglish(o.key || '', `output${idx + 1}`);
      key = generateUniqueName(key, usedVarNames);
      return { ...o, key };
    });
  }

  // 함수명 추출: 개요/기능명/제목 등에서 키워드 추출, 없으면 'mainFeature'
  let funcName = 'mainFeature';
  if (json['기능명']) funcName = koreanToEnglish(json['기능명'], 'mainFeature');
  else if (json['개요']) funcName = koreanToEnglish(json['개요'].split(/[ ,\n]/)[0], 'mainFeature');
  else if (json['기능 상세설명'])
    funcName = koreanToEnglish(json['기능 상세설명'].split(/[ ,\n]/)[0], 'mainFeature');
  funcName = generateUniqueName(funcName, usedFuncNames);

  // 주석 생성 (주석은 한글 허용)
  let doc = '/**\n';
  if (json['개요']) doc += ` * 개요: ${json['개요']}\n`;
  if (json['기능 상세설명']) doc += ` * 기능 상세설명: ${json['기능 상세설명']}\n`;
  if (json['기능 Flow']) doc += ` * 기능 Flow: ${(json['기능 Flow'] || []).join(' → ')}\n`;
  if (inputVars.length)
    doc += ` * 예상 input: ${inputVars.map(i => `${i.key}(${i.type}): ${i.desc}`).join(', ')}\n`;
  if (outputVars.length)
    doc += ` * 예상 output: ${outputVars.map(o => `${o.key}(${o.type}): ${o.desc}`).join(', ')}\n`;
  doc += ' */\n';

  // 상태 관리 변수 생성 (전역 let, 중복 없음)
  let stateVars = '';
  if (inputVars.length) {
    stateVars = inputVars
      .map(i => `let ${i.key} = ${i.type === 'boolean' ? 'false' : "''"};`)
      .join('\n');
  }

  // DOM 요소 생성 함수 (중복 방지, 함수 내부 임시 변수도 유일하게)
  let createElementFuncs = '';
  let buttonFuncIdx = 1;
  let buttonVarIdx = 1;
  let buttonFuncNames = [];
  let setStyleFuncNames = [];
  if (inputVars.length) {
    createElementFuncs = inputVars
      .map(i => {
        if (i.key.toLowerCase().includes('button')) {
          const createFunc = generateUniqueName('createButton', usedFuncNames);
          const setStyleFunc = generateUniqueName('setButtonStyle', usedFuncNames);
          buttonFuncNames.push(createFunc);
          setStyleFuncNames.push(setStyleFunc);
          const buttonVar = `button${buttonVarIdx++}`;
          return `\n// ${i.key} 생성 함수\nfunction ${createFunc}() {\n  const ${buttonVar} = document.createElement("button");\n  ${setStyleFunc}(${buttonVar});\n  ${buttonVar}.textContent = "테스트 실행";\n  return ${buttonVar};\n}\n\n// ${i.key} 스타일 설정 함수\nfunction ${setStyleFunc}(${buttonVar}) {\n  ${buttonVar}.style.backgroundColor = "red";\n  ${buttonVar}.style.color = "white";\n  ${buttonVar}.style.fontSize = "1.5rem";\n  ${buttonVar}.style.padding = "1rem 2rem";\n  ${buttonVar}.style.border = "none";\n  ${buttonVar}.style.borderRadius = "8px";\n  ${buttonVar}.style.cursor = "pointer";\n}`;
        }
        return '';
      })
      .join('\n');
  }

  // 이벤트 핸들링 함수 (중복 방지)
  let eventHandlers = '';
  let handleFuncNames = [];
  buttonVarIdx = 1;
  if (inputVars.length) {
    eventHandlers = inputVars
      .map(i => {
        if (i.key.toLowerCase().includes('button')) {
          const handleFunc = generateUniqueName('handleClick', usedFuncNames);
          handleFuncNames.push(handleFunc);
          const buttonVar = `button${buttonVarIdx++}`;
          return `\n// ${i.key} 클릭 이벤트 핸들링 함수\nfunction ${handleFunc}(${buttonVar}) {\n  ${i.key} = true;\n  ${buttonVar}.style.backgroundColor = "green";\n  ${buttonVar}.textContent = "실행중";\n  ${buttonVar}.disabled = true;\n}`;
        }
        return '';
      })
      .join('\n');
  }

  // 요소 배치 함수 (중복 방지)
  let layoutFuncs = '';
  let centerFuncNames = [];
  buttonVarIdx = 1;
  if (inputVars.length) {
    layoutFuncs = inputVars
      .map(i => {
        if (i.key.toLowerCase().includes('button')) {
          const centerFunc = generateUniqueName('centerButton', usedFuncNames);
          centerFuncNames.push(centerFunc);
          const buttonVar = `button${buttonVarIdx++}`;
          return `\n// ${i.key}를 페이지 중앙에 배치하는 함수\nfunction ${centerFunc}(${buttonVar}) {\n  const container = document.createElement("div");\n  container.style.display = "flex";\n  container.style.justifyContent = "center";\n  container.style.alignItems = "center";\n  container.style.height = "100vh";\n  container.appendChild(${buttonVar});\n  document.body.appendChild(container);\n}`;
        }
        return '';
      })
      .join('\n');
  }

  // 메인 함수 (중복 방지, 임시 변수명 유일하게)
  let mainFunc = `\n// 메인 함수\nfunction init() {\n  ${inputVars
    .map((i, idx) => {
      if (i.key.toLowerCase().includes('button')) {
        const createFunc = buttonFuncNames[idx];
        const handleFunc = handleFuncNames[idx];
        const centerFunc = centerFuncNames[idx];
        const buttonVar = `button${idx + 1}`;
        return `const ${buttonVar} = ${createFunc}();\n  ${buttonVar}.addEventListener("click", () => ${handleFunc}(${buttonVar}));\n  ${centerFunc}(${buttonVar});`;
      }
      return '';
    })
    .join('\n  ')}\n}\n\n// 초기화\ninit();`;

  // 최종 코드 생성
  const code = `${doc}\n${stateVars}\n\n${createElementFuncs}\n\n${eventHandlers}\n\n${layoutFuncs}\n\n${mainFunc}`;

  // 코드 실행 시 에러 확인
  try {
    // 문법 에러 확인
    new Function(code);
    // 런타임 에러 확인 (실제 실행은 하지 않음)
    return code;
  } catch (error) {
    console.error('코드 생성 중 에러 발생:', error);
    // 에러 발생 시 기본 코드 반환
    return `// 에러 발생으로 인해 기본 코드 반환\nfunction init() {\n  console.log("기본 코드 실행");\n}\n\ninit();`;
  }
}

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9가-힣_\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join('');
}

// 파일명 생성 함수 (날짜만)
function getTodayFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

module.exports = {
  sendTeamsNotification,
  handleTeamsWebhook,
  convertTextToJson,
};
