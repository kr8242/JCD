const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const serverless = require('serverless-http');

const app = express();

// 1. 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. 몽고DB 연결 및 스키마 정의
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
};

const PressSchema = new mongoose.Schema({ title: String, content: String, date: { type: Date, default: Date.now } });
const Press = mongoose.models.Press || mongoose.model('Press', PressSchema);

const StockSchema = new mongoose.Schema({ price: Number, change: Number, updatedAt: { type: Date, default: Date.now } });
const Stock = mongoose.models.Stock || mongoose.model('Stock', StockSchema);

// 3. 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'jangchung-dong-gukbap-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions' 
    }),
    cookie: { maxAge: 60 * 60 * 1000 } // 1시간 유지
}));

// 모든 API 요청 전 DB 연결 확인
app.use(async (req, res, next) => {
    try { await connectDB(); next(); } 
    catch (err) { res.status(500).json({ error: 'DB 연결 실패' }); }
});

// 4. API 라우터 (데이터 통신)
app.get('/api/init-data', async (req, res) => {
    try {
        const newsList = await Press.find({}).sort({ date: -1 });
        const stockData = await Stock.findOne({}).sort({ updatedAt: -1 });
        
        res.json({
            pressReleases: newsList.length > 0 ? newsList : [{ title: "서버 연결 완료", content: "데이터베이스 연동이 완료되었습니다." }],
            stock: stockData || { price: 50000, change: 0 },
            user: req.session.user || null // 세션에 저장된 user(isAdmin 포함)가 프론트로 전달됨
        });
    } catch (err) { res.status(500).json({ error: '데이터 로드 실패' }); }
});

// 5. 디스코드 OAuth2 로그인 라우터
app.get('/auth/discord', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify`);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
        }));
        
        const userResponse = await axios.get('https://discord.com/api/users/@me', { 
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` } 
        });
        
        // ★ 최고 관리자 명단 배열 정의
        const adminList = ['kr8242', 'OAtun2'];
        const loggedInUsername = userResponse.data.username;
        
        // 세션 유저 객체에 isAdmin 판별 결과값 주입
        req.session.user = {
            id: userResponse.data.id,
            username: loggedInUsername,
            avatar: userResponse.data.avatar,
            isAdmin: adminList.includes(loggedInUsername) // true 또는 false 저장
        };
        
        res.redirect('/');
    } catch (err) { res.status(500).send('로그인 실패'); }
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// 6. Netlify 서버리스 환경으로 내보내기
module.exports = app;
module.exports.handler = serverless(app);