/**
 * [장충동왕국밥] 통합 API 브릿지
 * 백엔드(server.js)를 통해 외부 주식 데이터 및 유저 세션을 안전하게 가져옵니다.
 */

async function fetchInitData() {
    try {
        // netlify.toml 설정에 따라 /.netlify/functions/server/api/init-data 로 연결됨
        const response = await fetch('/api/init-data');
        
        if (!response.ok) {
            throw new Error(`통신 실패 (Status: ${response.status})`);
        }
        
        const data = await response.json();
        
        // data 안에는 { pressReleases, stockData, user } 가 포함되어 반환됩니다.
        return data; 
        
    } catch (error) {
        console.error("API 통신 오류:", error);
        return null; // 오류 발생 시 app.js에서 초기 데이터 없음(null)으로 안전하게 처리
    }
}