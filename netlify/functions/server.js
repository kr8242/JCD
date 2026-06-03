const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Netlify(HTTPS) 프록시 환경에서 세션을 정상적으로 굽기 위한 설정
app.set('trust proxy', 1);

// 1. 몽고DB 연결 및 스키마 정의
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        isConnected = true;
    } catch (err) {
        console.error('MongoDB 연결 실패:', err);
    }
};
const Press = mongoose.models.Press || mongoose.model('Press', new mongoose.Schema({ title: String, content: String, date: { type: Date, default: Date.now } }));

// 2. 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'jangchung-dong-gukbap-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { 
        maxAge: 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production', // 넷리파이 환경에서는 true로 작동
        httpOnly: true
    }
}));

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// =========================================================================
// API 라우터 (통합 데이터 로드)
// =========================================================================
const apiRouter = express.Router();

apiRouter.get('/init-data', async (req, res) => {
    try {
        const newsList = await Press.find({}).sort({ date: -1 });
        
        let stockApiData = null;
        try {
            // Netlify 서버리스 환경에서 외부 API 호출 시 타임아웃 및 봇 차단 방지
            const apiRes = await axios.get('http://vers.kro.kr:4050/api/stockdataload/Securitykey_153295981258912938598/%EC%9E%A5%EC%B6%A9%EB%8F%99%EC%99%95%EA%B5%AD%EB%B0%A5', {
                timeout: 8000, // 8초 이상 지연되면 강제 취소 (Netlify 기본 제한은 10초)
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

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


// =========================================================================
// Auth 라우터 (디스코드 로그인)
// =========================================================================
const authRouter = express.Router();

authRouter.get('/discord', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify`);
});

authRouter.get('/discord/callback', async (req, res) => {
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

authRouter.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});


// =========================================================================
// Netlify 호환성을 위한 라우트 마운트
// =========================================================================
// 로컬 테스트용 경로
app.use('/api', apiRouter);
app.use('/auth', authRouter);

// Netlify 배포용 경로 (Netlify는 기본적으로 이 경로로 함수를 실행합니다)
app.use('/.netlify/functions/server/api', apiRouter);
app.use('/.netlify/functions/server/auth', authRouter);

module.exports = app;
module.exports.handler = serverless(app);