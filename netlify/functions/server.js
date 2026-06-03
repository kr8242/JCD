const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. 몽고DB 연결 및 스키마 정의 (기존 보도자료 등 유지)
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
};
const Press = mongoose.models.Press || mongoose.model('Press', new mongoose.Schema({ title: String, content: String, date: { type: Date, default: Date.now } }));

// 2. 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'jangchung-dong-gukbap-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 60 * 60 * 1000 }
}));

app.use(async (req, res, next) => {
    try { await connectDB(); next(); } 
    catch (err) { res.status(500).json({ error: 'DB 연결 실패' }); }
});

// 3. 통합 데이터 로드 라우터 (보도자료 + 디스코드 세션 + 외부 주식 API 프록시)
app.get('/api/init-data', async (req, res) => {
    try {
        const newsList = await Press.find({}).sort({ date: -1 });
        
        // Netlify HTTPS 환경에서 HTTP 주식 API를 안전하게 불러오기 위한 백엔드 우회(Proxy) 호출
        let stockApiData = null;
        try {
            const apiRes = await axios.get('http://vers.kro.kr:4050/api/stockdataload/Securitykey_153295981258912938598/%EC%9E%A5%EC%B6%A9%EB%8F%99%EC%99%95%EA%B5%AD%EB%B0%A5');
            if (apiRes.data && apiRes.data.data && apiRes.data.data.StockData) {
                stockApiData = apiRes.data.data.StockData;
            }
        } catch (apiErr) {
            console.error("외부 주식 API 로드 실패:", apiErr.message);
        }
        
        res.json({
            pressReleases: newsList,
            stockData: stockApiData,
            user: req.session.user || null 
        });
    } catch (err) { 
        res.status(500).json({ error: '통합 데이터 로드 실패' }); 
    }
});

// 4. 디스코드 OAuth2 로그인 및 OAtun2 권한 확인 로직
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
        
        // ★ 최고 관리자 명단에 OAtun2 및 기존 관리자 포함
        const adminList = ['kr8242', 'OAtun2', 'oatun2'];
        const loggedInUsername = userResponse.data.username;
        
        req.session.user = {
            id: userResponse.data.id,
            username: loggedInUsername,
            avatar: userResponse.data.avatar,
            isAdmin: adminList.includes(loggedInUsername)
        };
        
        res.redirect('/');
    } catch (err) { 
        res.status(500).send('디스코드 로그인 실패'); 
    }
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = app;
module.exports.handler = serverless(app);