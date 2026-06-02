// 백엔드 API와 통신하여 데이터를 가져오는 함수
async function fetchInitData() {
    try {
        const response = await fetch('/api/init-data');
        if (!response.ok) throw new Error('네트워크 응답이 정상이 아닙니다.');
        
        const data = await response.json();
        return data; // { pressReleases, stock, user } 객체 반환
    } catch (error) {
        console.error('데이터 통신 에러:', error);
        return null;
    }
}