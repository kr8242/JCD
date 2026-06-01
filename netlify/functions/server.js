const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mongoose = require('mongoose');
// 에러 방지를 위한 수정: .default 또는 직접 가져오기
const MongoStore = require('connect-mongo');
const serverless = require('serverless-http');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 몽고DB 연결
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
};

// 스키마 정의
const PressSchema = new mongoose.Schema({ title: String, content: String, date: { type: Date, default: Date.now } });
const Press = mongoose.models.Press || mongoose.model('Press', PressSchema);

const StockSchema = new mongoose.Schema({ price: Number, change: Number, updatedAt: { type: Date, default: Date.now } });
const Stock = mongoose.models.Stock || mongoose.model('Stock', StockSchema);

// 세션 설정 (에러 방지: 생성자 사용)
app.use(session({
    secret: 'jangchung-dong-gukbap-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions' 
    }),
    cookie: { maxAge: 60 * 60 * 1000 }
}));

// DB 미들웨어
app.use(async (req, res, next) => {
    try { await connectDB(); next(); } 
    catch (err) { res.status(500).json({ error: 'DB 연결 실패' }); }
});

// API 라우터
app.get('/api/init-data', async (req, res) => {
    try {
        const newsList = await Press.find({}).sort({ date: -1 });
        const stockData = await Stock.findOne({}).sort({ updatedAt: -1 });
        res.json({
            pressReleases: newsList.length > 0 ? newsList : [{ title: "서버 정상 작동", content: "데이터 연동 완료" }],
            stock: stockData || { price: 50000, change: 0 },
            user: req.session.user || null
        });
    } catch (err) { res.status(500).json({ error: '데이터 로드 실패' }); }
});

// 디스코드 인증
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
        const userResponse = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` } });
        req.session.user = userResponse.data;
        res.redirect('/');
    } catch (err) { res.status(500).send('로그인 실패'); }
});

module.exports = app;
module.exports.handler = serverless(app);