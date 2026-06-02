/**
 * 장충동왕국밥 통합 API 통신 레이어
 */

// 1. 초기 데이터(보도자료, 주가, 유저 세션 정보)를 서버로부터 가져오는 함수
async function fetchInitData() {
    try {
        // netlify.toml 리다이렉트 설정에 의해 /.netlify/functions/server/api/init-data 로 라우팅됨
        const response = await fetch('/api/init-data');
        
        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("fetchInitData 통신 중 에러 발생:", error);
        return null;
    }
}

// 2. 필요 시 추가적인 백엔드 데이터 송수신 함수를 이 아래에 확장 가능합니다.
// 예: 지점 저장 API, 보도자료 DB 저장 API 등