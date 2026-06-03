// ==========================================
// 1. 전역 상태 변수
// ==========================================
let currentUser = null;
let isDeveloper = false;
// ※ 4월 기준가 (정확한 4월 가격이 API에 없다면 이 변수값을 수정하여 기준을 맞출 수 있습니다)
const APRIL_BASE_PRICE = 2000; 

// ==========================================
// 2. SPA(Single Page Application) 라우팅 기능 (/home, /stock)
// ==========================================
function navigate(path) {
    // 브라우저 주소창 변경 (새로고침 없이)
    window.history.pushState({}, path, path);
    renderView(path);
}

function renderView(path) {
    // 모든 뷰 화면 숨기기
    document.querySelectorAll('.page-view').forEach(view => {
        view.style.display = 'none';
    });
    
    // 경로에 맞춰 해당 뷰만 보여주기
    if (path.includes('/stock')) {
        const stockView = document.getElementById('view-stock');
        if (stockView) stockView.style.display = 'block';
    } else {
        // 기본 경로는 /home 으로 간주
        const homeView = document.getElementById('view-home');
        if (homeView) homeView.style.display = 'block';
    }
}

// 브라우저 '뒤로가기' 버튼 대응
window.addEventListener('popstate', () => {
    renderView(window.location.pathname);
});


// ==========================================
// 3. 디스코드 로그인 및 권한 제어 UI
// ==========================================
function applyDeveloperAuthority(status) {
    isDeveloper = status;
    const adminElements = document.querySelectorAll('.admin-only'); // 관리자 전용 UI 요소들
    adminElements.forEach(el => {
        el.style.display = status ? 'inline-block' : 'none';
    });
}

function updateAuthUI(user) {
    const btn = document.getElementById('discord-btn');
    if (!btn) return;

    if (user) {
        currentUser = user;
        btn.innerText = `${user.username} (로그아웃)`;
        btn.style.backgroundColor = "#248046";
        btn.onclick = () => {
            if (confirm("로그아웃 하시겠습니까?")) location.href = '/auth/logout';
        };
        applyDeveloperAuthority(user.isAdmin); // OAtun2 등 백엔드에서 인증된 관리자 여부 적용
    } else {
        currentUser = null;
        btn.innerText = "디스코드 로그인";
        btn.style.backgroundColor = "#5865F2";
        btn.onclick = () => location.href = '/auth/discord';
        applyDeveloperAuthority(false);
    }
}


// ==========================================
// 4. 외부 주식 데이터 계산 및 렌더링 로직
// ==========================================
function renderStockData(stockData) {
    if (!stockData) return;

    const price = stockData.Price;         // 현재 호가
    const oldPrice = stockData.OldPrice;   // 시가
    const total = stockData.Total;         // 발행된 주식 수
    
    // 요청하신 공식에 따른 계산 로직
    const marketCap = price * total; 
    const dailyRate = oldPrice ? ((price - oldPrice) / oldPrice) * 100 : 0;
    const aprilRate = ((price - APRIL_BASE_PRICE) / APRIL_BASE_PRICE) * 100;

    // 통화 및 퍼센트 포맷팅
    const formatPrice = price.toLocaleString() + '원';
    const formatMarketCap = marketCap.toLocaleString() + '원';
    const formatDailyRate = dailyRate.toFixed(2) + '%';
    const formatAprilRate = aprilRate.toFixed(2) + '%';

    // HTML 요소에 텍스트 반영 (클래스 기반으로 찾아 홈과 주식화면 양쪽에 동시 적용)
    document.querySelectorAll('.display-price').forEach(el => el.innerText = formatPrice);
    document.querySelectorAll('.display-marketcap').forEach(el => el.innerText = formatMarketCap);
    
    // 색상 처리 (상승: 빨강, 하락: 파랑)
    document.querySelectorAll('.display-dailyrate').forEach(el => {
        el.innerText = (dailyRate > 0 ? '+' : '') + formatDailyRate;
        el.style.color = dailyRate > 0 ? '#ff4d4d' : (dailyRate < 0 ? '#4d79ff' : '#d8dee8');
    });
    
    document.querySelectorAll('.display-aprilrate').forEach(el => {
        el.innerText = (aprilRate > 0 ? '+' : '') + formatAprilRate;
        el.style.color = aprilRate > 0 ? '#ff4d4d' : (aprilRate < 0 ? '#4d79ff' : '#d8dee8');
    });

    // ==========================================
    // 5. stock.html (그래프) Iframe 동적 삽입
    // ==========================================
    const iframeHTML = `<iframe src="/stock.html" style="width: 100%; height: 100%; border: none; background: transparent;" title="주식 차트"></iframe>`;
    
    const homeGraphContainer = document.getElementById('home-graph-container');
    if (homeGraphContainer && !homeGraphContainer.innerHTML.includes('iframe')) {
        homeGraphContainer.innerHTML = iframeHTML;
    }

    const stockGraphContainer = document.getElementById('stock-graph-container');
    if (stockGraphContainer && !stockGraphContainer.innerHTML.includes('iframe')) {
        stockGraphContainer.innerHTML = iframeHTML;
    }
}


// ==========================================
// 6. 초기 웹사이트 구동
// ==========================================
async function initWebsite() {
    // 1. 현재 접속한 URL 주소에 따라 화면 렌더링 (/home 또는 /stock)
    renderView(window.location.pathname);

    try {
        // 2. api.js를 통해 서버(디스코드 세션 + 주식 API 프록시) 데이터 로드
        const data = await fetchInitData(); 
        
        if (data) {
            updateAuthUI(data.user);
            if (data.stockData) {
                renderStockData(data.stockData);
            }
            // 기존 보도자료 렌더링 함수가 있다면 이 부분에 추가
            // if (data.pressReleases) renderPressReleases(data.pressReleases);
        }
    } catch (err) {
        console.error("초기 데이터 로드 중 에러 발생:", err);
        updateAuthUI(null);
    }
}

// DOM 생성이 완료되면 시스템 시작
window.addEventListener('DOMContentLoaded', initWebsite);