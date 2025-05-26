// 코드 생성 관련 유틸 함수

const generateDraftJsCode = json => {
  // 한글 키워드를 영문으로 변환하는 간단한 매핑 테이블
  const keywordMap = {
    기능: 'function',
    설명: 'description',
    입력: 'input',
    출력: 'output',
    예시: 'example',
    참고: 'note',
  };

  // 한글 문자열을 camelCase로 변환하는 함수
  const toCamelCase = str => {
    return str
      .replace(/[가-힣]+/g, match => keywordMap[match] || match)
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  };

  // 고유한 변수명 생성
  const generateUniqueVarName = (base, usedNames) => {
    let name = toCamelCase(base);
    let counter = 1;
    while (usedNames.has(name)) {
      name = `${toCamelCase(base)}${counter++}`;
    }
    usedNames.add(name);
    return name;
  };

  // 입력/출력 변수 생성
  const generateInputOutputVars = (json, usedNames) => {
    const vars = [];
    if (json.input) {
      const inputVar = generateUniqueVarName('input', usedNames);
      vars.push(`const ${inputVar} = ${JSON.stringify(json.input, null, 2)};`);
    }
    if (json.output) {
      const outputVar = generateUniqueVarName('output', usedNames);
      vars.push(`const ${outputVar} = ${JSON.stringify(json.output, null, 2)};`);
    }
    return vars.join('\n');
  };

  // 함수명 추출
  const functionName = toCamelCase(json.function || 'defaultFunction');

  // 문서화 주석 생성
  const generateDocComment = json => {
    return `/**\n * ${
      json.description || '함수 설명'
    }\n * @param {Object} input - 입력 파라미터\n * @returns {Object} 출력 결과\n */`;
  };

  // DOM 요소 생성
  const generateDomElements = (json, usedNames) => {
    const elements = [];
    if (json.input) {
      const inputContainer = generateUniqueVarName('inputContainer', usedNames);
      elements.push(`const ${inputContainer} = document.createElement('div');`);
      elements.push(`${inputContainer}.className = 'input-container';`);
    }
    if (json.output) {
      const outputContainer = generateUniqueVarName('outputContainer', usedNames);
      elements.push(`const ${outputContainer} = document.createElement('div');`);
      elements.push(`${outputContainer}.className = 'output-container';`);
    }
    return elements.join('\n');
  };

  // 이벤트 핸들러 생성
  const generateEventHandlers = (json, usedNames) => {
    const handlers = [];
    if (json.input) {
      const handleInput = generateUniqueVarName('handleInput', usedNames);
      handlers.push(
        `const ${handleInput} = (event) => {\n  // 입력 처리 로직\n  console.log('Input changed:', event.target.value);\n};`
      );
    }
    return handlers.join('\n');
  };

  // 요소 배치
  const generateLayout = (json, usedNames) => {
    const layout = [];
    if (json.input) {
      const inputContainer = generateUniqueVarName('inputContainer', usedNames);
      layout.push(`document.body.appendChild(${inputContainer});`);
    }
    if (json.output) {
      const outputContainer = generateUniqueVarName('outputContainer', usedNames);
      layout.push(`document.body.appendChild(${outputContainer});`);
    }
    return layout.join('\n');
  };

  // 메인 함수 생성
  const generateMainFunction = (json, usedNames) => {
    const mainFunction = generateUniqueVarName('main', usedNames);
    return `const ${mainFunction} = () => {\n  // 초기화\n  const usedNames = new Set();\n  ${generateInputOutputVars(
      json,
      usedNames
    )}\n  ${generateDomElements(json, usedNames)}\n  ${generateEventHandlers(
      json,
      usedNames
    )}\n  ${generateLayout(json, usedNames)}\n};`;
  };

  // 코드 생성
  const usedNames = new Set();
  const code = `\n${generateDocComment(
    json
  )}\nfunction ${functionName}() {\n  ${generateMainFunction(
    json,
    usedNames
  )}\n  ${generateUniqueVarName('main', usedNames)}();\n}\n\n// 코드 실행\n${functionName}();\n`;

  // 생성된 코드의 문법 검사
  try {
    new Function(code);
  } catch (error) {
    console.error('Generated code has syntax errors:', error);
    return null;
  }

  return code;
};

module.exports = {
  generateDraftJsCode,
};
