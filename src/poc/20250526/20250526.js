/**
 * 개요: 테스트 실행 버튼 만들기
 * 기능 상세설명: 페이지 가운데에 테스트 실행 버튼을 생성하고 버튼 클릭 시 색상 변경 및 텍스트 변경이 발생
 * 기능 Flow: 1. 버튼을 클릭한다 → 2. 버튼의 색상과 텍스트가 toggle 된다
 * 예상 input: buttonText(string): 버튼의 초기 텍스트 값 '테스트 실행'
 * 예상 output: buttonColor(string): 버튼의 색상이 'red' 또는 'green', buttonText1(string): 버튼의 텍스트가 '테스트 실행' 또는 '실행중'
 */

let buttonText = '';


// buttonText 생성 함수
function createButton() {
  const button1 = document.createElement("button");
  setButtonStyle(button1);
  button1.textContent = "테스트 실행";
  return button1;
}

// buttonText 스타일 설정 함수
function setButtonStyle(button1) {
  button1.style.backgroundColor = "red";
  button1.style.color = "white";
  button1.style.fontSize = "1.5rem";
  button1.style.padding = "1rem 2rem";
  button1.style.border = "none";
  button1.style.borderRadius = "8px";
  button1.style.cursor = "pointer";
}


// buttonText 클릭 이벤트 핸들링 함수
function handleClick(button1) {
  buttonText = true;
  button1.style.backgroundColor = "green";
  button1.textContent = "실행중";
  button1.disabled = true;
}


// buttonText를 페이지 중앙에 배치하는 함수
function centerButton(button1) {
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  container.style.height = "100vh";
  container.appendChild(button1);
  document.body.appendChild(container);
}


// 메인 함수
function init() {
  const button1 = createButton();
  button1.addEventListener("click", () => handleClick(button1));
  centerButton(button1);
}

// 초기화
init();