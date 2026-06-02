document.addEventListener('DOMContentLoaded', async () => {
    // 1. api.js의 함수를 이용해 데이터 가져오기
    const data = await fetchInitData();
    
    if (!data) {
        document.getElementById('news-container').innerHTML = '<p>데이터를 불러오지 못했습니다.</p>';
        return;
    }

    // 2. 디스코드 로그인 상태 화면 갱신
    const authDiv = document.getElementById('auth-section');
    if (data.user) {
        authDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png" alt="프로필" class="w-8 h-8 rounded-full">
                <span class="font-bold">${data.user.username}님 환영합니다!</span>
                <a href="/auth/logout" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">로그아웃</a>
            </div>
        `;
    } else {
        authDiv.innerHTML = `
            <a href="/auth/discord" class="px-4 py-2 bg-[#5865F2] text-white rounded font-bold hover:bg-[#4752C4] transition">디스코드 로그인</a>
        `;
    }

    // 3. 주가 정보 화면 갱신
    const stockElement = document.getElementById('stock-price');
    const changeElement = document.getElementById('stock-change');
    
    stockElement.textContent = `${data.stock.price.toLocaleString()}원`;
    
    if (data.stock.change > 0) {
        changeElement.textContent = `▲ ${data.stock.change}`;
        changeElement.className = "text-red-500 font-bold ml-2";
    } else if (data.stock.change < 0) {
        changeElement.textContent = `▼ ${Math.abs(data.stock.change)}`;
        changeElement.className = "text-blue-500 font-bold ml-2";
    } else {
        changeElement.textContent = `-`;
        changeElement.className = "text-gray-500 font-bold ml-2";
    }

    // 4. 보도자료(뉴스) 리스트 화면 갱신
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = ''; // 기존 로딩 텍스트 지우기
    
    data.pressReleases.forEach(news => {
        const dateStr = new Date(news.date).toLocaleDateString();
        const newsHTML = `
            <div class="border-b border-gray-200 py-4">
                <h3 class="font-bold text-lg text-gray-800">${news.title}</h3>
                <p class="text-sm text-gray-500 mt-1">${dateStr}</p>
                <p class="text-gray-700 mt-2">${news.content}</p>
            </div>
        `;
        newsContainer.insertAdjacentHTML('beforeend', newsHTML);
    });
});