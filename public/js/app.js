// 전역 상태 관리 변수
let currentUser = null;
let isDeveloper = false;
let currentEditBlock = null;
let modalSelectedStatus = "";
let modalSelectedBadges = [];

// 페이지 내비게이션 함수
function navigate(viewName, clickedElement) {
    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active-view'));
    const targetView = document.getElementById('view-' + viewName);
    if (targetView) targetView.classList.add('active-view');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (clickedElement) clickedElement.classList.add('active');
}

// 최고 관리자 권한에 따른 UI 요소 노출/숨김 제어
function applyDeveloperAuthority(status) {
    isDeveloper = status;
    const badge = document.getElementById('admin-badge');
    const addBranchBtn = document.getElementById('btn-add-branch');
    const addPressBtn = document.getElementById('btn-add-press');
    const editButtons = document.querySelectorAll('.edit-btn');
    const deletePressBtns = document.querySelectorAll('.delete-press-btn');

    if (status) {
        if (badge) badge.classList.add('active');
        if (addBranchBtn) addBranchBtn.style.display = 'inline-block';
        if (addPressBtn) addPressBtn.style.display = 'inline-block';
        editButtons.forEach(el => el.style.display = 'inline-block');
        deletePressBtns.forEach(el => el.style.display = 'inline-block');
    } else {
        if (badge) badge.classList.remove('active');
        if (addBranchBtn) addBranchBtn.style.display = 'none';
        if (addPressBtn) addPressBtn.style.display = 'none';
        editButtons.forEach(el => el.style.display = 'none');
        deletePressBtns.forEach(el => el.style.display = 'none');
    }
}

// 디스코드 로그인/로그아웃 버튼 UI 업데이트 및 세션 연동
function updateAuthUI(user) {
    const btn = document.getElementById('discord-btn');
    if (!btn) return;

    if (user) {
        currentUser = user;
        btn.innerText = `${user.username} (로그아웃)`;
        btn.style.backgroundColor = "#248046";
        btn.onclick = () => {
            if (confirm("로그아웃 하시겠습니까?")) {
                location.href = '/auth/logout';
            }
        };
        
        // 서버 세션에서 검증된 isAdmin 값에 따라 권한 부여 (kr8242, OAtun2 차별 없이 적용)
        if (user.isAdmin === true) {
            applyDeveloperAuthority(true);
        } else {
            applyDeveloperAuthority(false);
        }
    } else {
        currentUser = null;
        btn.innerText = "디스코드 로그인";
        btn.style.backgroundColor = "#5865F2";
        btn.onclick = () => {
            location.href = '/auth/discord';
        };
        applyDeveloperAuthority(false);
    }
}

// 상태별 텍스트 컬러 클래스 매핑
function getStatusClass(status) {
    if (status === '운영중') return 'text-neon-green';
    if (status === '운영중단') return 'text-neon-red';
    if (status === '브레이크') return 'text-neon-salmon';
    return '';
}

// 추가 태그 배지 HTML 생성
function getBadgesHTML(badges) {
    return badges.map(b => {
        if (b === '양호') return `<span class="text-neon-lightgreen" style="font-size:14px; vertical-align:super;">(양호)</span>`;
        if (b === '혼잡') return `<span class="text-neon-red" style="font-size:14px; vertical-align:super;">(혼잡)</span>`;
        if (b === '정배중') return `<span class="text-neon-blue" style="font-size:14px; vertical-align:super;">(정배중)</span>`;
        return '';
    }).join(' ');
}

// 모달 내부 미리보기 갱신
function updateModalPreview() {
    if (!currentEditBlock) return;
    const storeName = currentEditBlock.querySelector('.store-name').innerText;
    document.getElementById('modal-text-after').innerHTML = `수정후 : ${storeName} : <span class="${getStatusClass(modalSelectedStatus)}">${modalSelectedStatus}</span> ${getBadgesHTML(modalSelectedBadges)}`;
}

// 모달 내 선택된 칩 하이라이트 효과
function highlightModalChips() {
    document.querySelectorAll('.p4-btn-group .chip-btn').forEach(btn => {
        const text = btn.innerText;
        if (text === modalSelectedStatus || modalSelectedBadges.includes(text)) {
            btn.classList.add('selected-chip');
        } else {
            btn.classList.remove('selected-chip');
        }
    });
}

// 운영현황 수정 팝업 열기
function openPopup(btn) {
    if (!isDeveloper) return;
    currentEditBlock = btn.closest('.store-status-block');
    
    const storeName = currentEditBlock.querySelector('.store-name').innerText;
    const currentStatus = currentEditBlock.querySelector('.store-status-text').innerText;
    const currentNote = currentEditBlock.querySelector('.store-note-text').innerText.replace("비고 : ", "");
    const badgeHTML = currentEditBlock.querySelector('.store-badge-area').innerHTML;
    
    modalSelectedStatus = currentStatus;
    modalSelectedBadges = [];
    if (badgeHTML.includes("양호")) modalSelectedBadges.push("양호");
    if (badgeHTML.includes("혼잡")) modalSelectedBadges.push("혼잡");
    if (badgeHTML.includes("정배중")) modalSelectedBadges.push("정배중");
    
    document.getElementById('modal-note-input').value = currentNote;
    document.getElementById('modal-text-before').innerHTML = `수정전 : ${storeName} : <span class="${getStatusClass(currentStatus)}">${currentStatus}</span> ${badgeHTML}`;
    
    updateModalPreview();
    highlightModalChips();
    
    document.getElementById('edit-popup').style.style.display = 'flex';
}

function closePopup() { 
    document.getElementById('edit-popup').style.display = 'none'; 
}

function setModalStatus(status) {
    modalSelectedStatus = status;
    updateModalPreview();
    highlightModalChips();
}

function toggleModalBadge(badge) {
    const idx = modalSelectedBadges.indexOf(badge);
    if (idx > -1) {
        modalSelectedBadges.splice(idx, 1);
    } else {
        modalSelectedBadges.push(badge);
    }
    updateModalPreview();
    highlightModalChips();
}

// 매장 수정 데이터 반영 (원래 로직 유지)
function submitStoreEdit() {
    if (!isDeveloper || !currentEditBlock) return;
    
    const noteValue = document.getElementById('modal-note-input').value.trim() || "X";
    const statusSpan = currentEditBlock.querySelector('.store-status-text');
    
    statusSpan.innerText = modalSelectedStatus;
    statusSpan.className = `store-status-text ${getStatusClass(modalSelectedStatus)}`;
    
    currentEditBlock.querySelector('.store-badge-area').innerHTML = getBadgesHTML(modalSelectedBadges);
    currentEditBlock.querySelector('.store-note-text').innerText = `비고 : ${noteValue}`;
    
    closePopup();
    alert("운영현황 데이터가 임시 동기화되었습니다!");
}

// 신규 지점 추가 추가 로직
function addNewStoreBranch() {
    if (!isDeveloper) return;
    const storeName = prompt("추가할 지점명을 입력하세요 (예: 3호점):");
    if (!storeName || !storeName.trim()) return;
    const storeStatus = prompt("상태를 입력하세요 (운영중 / 운영중단 / 브레이크):", "운영중");
    if (!storeStatus) return;
    const storeNote = prompt("비고 사항을 입력하세요:", "X");
    if (!storeNote) return;

    const container = document.getElementById('store-list-container');
    const newBlock = document.createElement('div');
    newBlock.className = 'store-status-block';
    newBlock.innerHTML = `
        <div class="store-title-area">
            <span class="store-name">${storeName.trim()}</span> : 
            <span class="store-status-text ${getStatusClass(storeStatus)}">${storeStatus}</span>
            <span class="store-badge-area"></span>
        </div>
        <div class="store-note-text" style="margin-top:5px;">비고 : ${storeNote}</div>
        <button class="pixel-rect-btn edit-btn" style="display:inline-block;" onclick="openPopup(this)">수정하기</button>
    `;
    container.appendChild(newBlock);
    alert(`${storeName} 지점이 리스트에 임시 추가되었습니다.`);
}

// 렌더링: DB에서 가져온 보도자료 화면에 그리기
function renderPressReleases(pressReleases) {
    const container = document.getElementById('press-list-container');
    if (!container) return;
    container.innerHTML = '';

    pressReleases.forEach(article => {
        const item = document.createElement('div');
        item.className = 'press-item';
        item.innerHTML = `
            <div class="press-item-title">
                ${article.title}
                <button class="delete-press-btn" onclick="deletePressArticle(this)">삭제</button>
            </div>
            <div>${article.content}</div>
        `;
        container.appendChild(item);
    });
}

// 렌더링: 주가 데이터 업데이트
function renderStockData(stock) {
    // 필요에 따라 홈 화면 및 주가 탭 데이터에 바인딩 처리
    console.log("주가 데이터 로드 완료:", stock);
}

// 웹사이트 초기 로드 및 백엔드 데이터 연동 함수 (★ 핵심 통합 포인트)
async function initWebsite() {
    try {
        // api.js 내의 가져오기 함수 호출 또는 직접 fetch 사용
        const data = await fetchInitData(); 
        
        if (data) {
            // 1. 보도자료 및 주가 데이터 렌더링
            if (data.pressReleases) renderPressReleases(data.pressReleases);
            if (data.stock) renderStockData(data.stock);
            
            // 2. 유저 인증 상태 확인 및 UI 업데이트 처리 (OAtun2 권한 포함 자동 핸들링)
            updateAuthUI(data.user);
        }
    } catch (err) {
        console.error("초기 데이터 로드 중 에러 발생:", err);
        updateAuthUI(null);
    }
}

// DOM 생성이 완료되면 시스템 구동
window.addEventListener('DOMContentLoaded', initWebsite);