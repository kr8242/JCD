const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 보안 설정
app.use(session({
    secret: 'jangchung-dong-gukbap-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 } // 1시간 유지
}));

// [메모리 DB] 실시간 상태 및 권한 제어 데이터
let addedAdmins = []; // 부관리자 유저네임 리스트

let currentStoresState = {
    1: { status: '운영중', tags: ['혼잡', '정배중'], note: 'X' },
    2: { status: '운영중단', tags: [], note: '인원부족으로 인한 운영중단' }
};

let pressReleases = [
    { 
        id: 1, 
        title: '장충동왕국밥, 동탄동 요식업계 최초 시가총액 100억 돌파', 
        content: '로블록스 동탄동 No.1 요식업 브랜드 장충동왕국밥이 사기업 최초 주식시장 상장 및 시가총액 100억원을 달성하며 대기록을 세웠습니다. 요식팩토리 관계자는 앞으로도 야외석 확장 및 정기배달 시스템 고도화에 박차를 가할 것이라고 밝혔습니다.', 
        date: '2026-04-20' 
    }
];
let nextNewsId = 2;

// [주가 데이터] PDF 1, 5페이지의 공식 정보 반영
let stockData = {
    price: '0,000',
    change: '+0,000',
    changePercent: '0.00%',
    marketCap: '00,000,000,000',
    totalShares: '46,500,000',
    majorShareholder: '요식팩토리(51%)',
    monthlyChange: '0.00%↓'
};

// [미들웨어] 최고 관리자(kr8242) 및 부관리자 권한 검증
const verifyAdmin = (req, res, next) => {
    const user = req.session.user;
    if (user && (user.username === 'kr8242' || addedAdmins.includes(user.username))) {
        next();
    } else {
        res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
};

// [OAuth2] 디스코드 인증 시작
app.get('/auth/discord', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
    const clientId = process.env.DISCORD_CLIENT_ID;
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(discordUrl);
});

// [OAuth2] 디스코드 인증 콜백 처리
app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');
    
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
            scope: 'identify'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        req.session.user = userResponse.data; // 세션에 유저 정보 저장
        res.redirect('/');
    } catch (error) {
        console.error('Discord Auth Error:', error.response ? error.response.data : error.message);
        res.send('디스코드 인증에 실패했습니다. 관리자 설정을 다시 확인해주세요.');
    }
});

// 로그아웃
app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// [API] 전체 화면 초기화 데이터 전송
app.get('/api/init-data', (req, res) => {
    res.json({
        user: req.session.user || null,
        addedAdmins,
        currentStoresState,
        pressReleases,
        stockData
    });
});

// [API] 부관리자 임명 및 해임 (관리자 전용)
app.post('/api/admin', verifyAdmin, (req, res) => {
    const { username } = req.body;
    if (username && !addedAdmins.includes(username)) {
        addedAdmins.push(username.trim());
    }
    res.json({ success: true, addedAdmins });
});

app.delete('/api/admin', verifyAdmin, (req, res) => {
    const { username } = req.body;
    addedAdmins = addedAdmins.filter(name => name !== username);
    res.json({ success: true, addedAdmins });
});

// [API] 매장 운영 상태 정보 전격 수정 (관리자 전용 - PDF 4페이지 구현)
app.post('/api/store/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    const { status, tags, note } = req.body;
    
    if (currentStoresState[id]) {
        currentStoresState[id] = {
            status: status,
            tags: tags || [],
            note: note ? note.trim() : 'X'
        };
        res.json({ success: true, currentStoresState });
    } else {
        res.status(404).json({ error: '존재하지 않는 매장 번호입니다.' });
    }
});

// [API] 보도자료 등록 및 삭제 (관리자 전용)
app.post('/api/news', verifyAdmin, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: '제목과 내용을 모두 채워주세요.' });

    const today = new Date().toISOString().split('T')[0];
    const newArticle = {
        id: nextNewsId++,
        title: title.trim(),
        content: content.trim(),
        date: today
    };
    pressReleases.unshift(newArticle);
    res.json({ success: true, pressReleases });
});

app.delete('/api/news/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    pressReleases = pressReleases.filter(news => news.id !== parseInt(id));
    res.json({ success: true, pressReleases });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` 장충동왕국밥 통합 백엔드가 활성화되었습니다.`);
    console.log(` 접속 주소: http://localhost:${PORT}`);
    console.log(`================================================================`);
});