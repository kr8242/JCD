const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const serverless = require('serverless-http');

const app = express();

// 부가적인 미들웨어 설정 (JSON 및 URL 인코딩 데이터 파싱)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. 몽고DB 연결 설정 및 함수
// ==========================================
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    if (!process.env.MONGO_URI) {
        console.error("환경변수 MONGO_URI가 설정되지 않았습니다.");
        return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
};

// ==========================================
// 2. 몽고DB 데이터 모델(Schema) 정의
// ==========================================
// 보도자료 스키마
const PressSchema = new mongoose.Schema({
    title: String,
    content: String,
    date: { type: Date, default: Date.now }
});
const Press = mongoose.models.Press || mongoose.model('Press', PressSchema);

// 주가 현황 스키마
const StockSchema = new mongoose.Schema({
    price: Number,
    change: Number,
    updatedAt: { type: Date, default: Date.now }
});
const Stock = mongoose.models.Stock || mongoose.model('Stock', StockSchema);

// ==========================================
// 3. 세션 설정 (인증 정보를 몽고DB에 저장)
// ==========================================
app.use(session({
    secret: 'jangchung-dong-gukbap-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI,
        ttl: 60 * 60 // 1시간 동안 세션 유지
    }),
    cookie: { 
        maxAge: 60 * 60 * 1000,
        secure: false // 배포 환경에 따라 https 적용 시 true로 변경 가능
    }
}));

// 모든 API 요청 전에 데이터베이스 연결을 보장하는 미들웨어
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error("DB 연결 에러:", err);
        res.status(500).json({ error: '데이터베이스 연결에 실패했습니다.' });
    }
});

// ==========================================
// 4. API 라우터 (데이터 조회 및 수정)
// ==========================================

// [조회] 주가, 보도자료, 로그인 유저 정보 한 번에 가져오기
app.get('/api/init-data', async (req, res) => {
    try {
        const newsList = await Press.find({}).sort({ date: -1 });
        const stockData = await Stock.findOne({}).sort({ updatedAt: -1 });

        // 처음 세팅해서 DB가 비어있을 때 프론트엔드가 깨지지 않도록 기본값 방어
        const defaultStock = stockData || { price: 50000, change: 0 };
        const defaultNews = newsList.length > 0 ? newsList : [
            { title: "서버 연결 완료", content: "몽고DB 데이터베이스와 성공적으로 연동되었습니다.", date: new Date() }
        ];

        res.json({
            pressReleases: defaultNews,
            stock: defaultStock,
            user: req.session.user || null
        });
    } catch (err) {
        res.status(500).json({ error: '데이터를 불러오지 못했습니다.' });
    }
});

// [수정] 주가 업데이트 API (관리자용)
app.post('/api/update-stock', async (req, res) => {
    // 안정을 위해 로그인 체크를 하려면 기능을 추가할 수 있습니다.
    const { price, change } = req.body;
    try {
        const newStock = new Stock({ price: Number(price), change: Number(change) });
        await newStock.save();
        res.json({ success: true, stock: newStock });
    } catch (err) {
        res.status(500).json({ error: '주가 업데이트 실패' });
    }
});

// [추가] 보도자료 등록 API (관리자용)
app.post('/api/add-news', async (req, res) => {
    const { title, content } = req.body;
    try {
        const newPress = new Press({ title, content });
        await newPress.save();
        res.json({ success: true, news: newPress });
    } catch (err) {
        res.status(500).json({ error: '보도자료 등록 실패' });
    }
});

// ==========================================
// 5. 디스코드 OAuth2 로그인 라우터
// ==========================================

// 디스코드 인증 페이지로 리다이렉트
app.get('/auth/discord', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(discordUrl);
});

// 디스코드 로그인 완료 후 콜백 처리
app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    try {
        // 1. 토큰 요청
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // 2. 유저 정보 요청
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // 3. 세션에 유저 데이터 저장 (프론트엔드에서 로그인 여부 식별용)
        req.session.user = {
            id: userResponse.data.id,
            username: userResponse.data.username,
            avatar: userResponse.data.avatar
        };

        // 로그인 완료 후 메인 페이지로 복귀
        res.redirect('/');
    } catch (err) {
        console.error('디스코드 로그인 에러:', err.response ? err.response.data : err.message);
        res.status(500).send('디스코드 로그인에 실패했습니다. 환경 변수와 디스코드 개발자 센터 설정을 확인해 주세요.');
    }
});

// 로그아웃 API
app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// ==========================================
// 6. Netlify 서버리스 핸들러 내보내기
// ==========================================
module.exports = app;
module.exports.handler = serverless(app);