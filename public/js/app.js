document.addEventListener('DOMContentLoaded', async () => {
    // 1. 탭 네비게이션 로직 (PDF의 상단 메뉴 구현)
    const tabs = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.page-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 모든 탭 비활성화 및 섹션 숨기기
            tabs.forEach(t => {
                t.classList.remove('active');
                t.classList.add('text-gray-500');
            });
            sections.forEach(s => s.classList.add('hidden-section'));

            // 클릭한 탭 활성화 및 해당 섹션 보이기
            tab.classList.add('active');
            tab.classList.remove('text-gray-500');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden-section');
        });
    });

    // 2. 백엔드 데이터 불러오기
    const data = await fetchInitData();
    if (!data) return;

    // 3. 디스코드 로그인 및 관리자 권한 UI (PDF 3, 4페이지)
    const authDiv = document.getElementById('auth-section');
    const adminBadges = document.querySelectorAll('#admin-badge, .admin-edit-btn');

    if (data.user) {
        authDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <img src="https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png" class="w-6 h-6 rounded-full">
                <span class="font-bold">${data.user.username}</span>
                <a href="/auth/logout" class="ml-2 text-gray-500 hover:text-red-500">로그아웃</a>
            </div>
        `;
        // 임시: 로그인한 유저에게 관리자 버튼 보이기 (나중에 특정 ID만 보이게 서버에서 제한 가능)
        adminBadges.forEach(el => el.classList.remove('hidden'));
    } else {
        authDiv.innerHTML = `<a href="/auth/discord" class="bg-[#5865F2] text-white px-3 py-1 rounded font-bold">Discord 로그인</a>`;
    }

    // 4. 주가 정보 렌더링 (PDF 1, 5페이지)
    const priceEl = document.getElementById('stock-price');
    const changeEl = document.getElementById('stock-change');
    
    priceEl.textContent = `₩${data.stock.price.toLocaleString()}`;
    if (data.stock.change > 0) {
        changeEl.textContent = `+${data.stock.change.toLocaleString()} (${((data.stock.change/data.stock.price)*100).toFixed(2)}%↑)`;
        changeEl.className = "text-red-600 font-bold pb-1 ml-2";
    } else if (data.stock.change < 0) {
        changeEl.textContent = `${data.stock.change.toLocaleString()} (${((Math.abs(data.stock.change)/data.stock.price)*100).toFixed(2)}%↓)`;
        changeEl.className = "text-blue-600 font-bold pb-1 ml-2";
    } else {
        changeEl.textContent = `+0 (0.00%↑)`;
        changeEl.className = "text-gray-500 font-bold pb-1 ml-2";
    }

    // 5. 보도자료 렌더링
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = ''; 
    data.pressReleases.forEach(news => {
        const dateStr = new Date(news.date).toLocaleDateString();
        newsContainer.insertAdjacentHTML('beforeend', `
            <div class="border-b border-gray-200 py-3">
                <h3 class="font-bold text-lg text-gray-800">${news.title}</h3>
                <p class="text-xs text-gray-400 mb-2">${dateStr}</p>
                <p class="text-sm text-gray-700">${news.content}</p>
            </div>
        `);
    });
});