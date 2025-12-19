const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// KIS API 설정
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443'; // 실전투자

// 토큰 저장소
let tokenStore = {
  accessToken: null,
  tokenExpiry: null,
  appKey: null,
  appSecret: null
};

// 액세스 토큰 발급
async function getAccessToken(appKey, appSecret) {
  if (tokenStore.accessToken && 
      tokenStore.tokenExpiry > Date.now() &&
      tokenStore.appKey === appKey) {
    return tokenStore.accessToken;
  }

  const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret
    })
  });

  const data = await response.json();
  
  if (data.access_token) {
    tokenStore = {
      accessToken: data.access_token,
      tokenExpiry: Date.now() + (data.expires_in * 1000) - 60000,
      appKey,
      appSecret
    };
    return data.access_token;
  }
  
  throw new Error(data.msg1 || '토큰 발급 실패');
}

// API 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { appKey, appSecret } = req.body;
    
    if (!appKey || !appSecret) {
      return res.status(400).json({ error: 'APP KEY와 APP SECRET이 필요합니다.' });
    }

    const token = await getAccessToken(appKey, appSecret);
    res.json({ success: true, message: '로그인 성공' });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// 거래량 상위 종목 조회
app.post('/api/volume-rank', async (req, res) => {
  try {
    const { appKey, appSecret, priceMin, priceMax } = req.body;
    const token = await getAccessToken(appKey, appSecret);

    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: 'J',
      FID_COND_SCR_DIV_CODE: '20171',
      FID_INPUT_ISCD: '0000',
      FID_DIV_CLS_CODE: '0',
      FID_BLNG_CLS_CODE: '0',
      FID_TRGT_CLS_CODE: '111111111',
      FID_TRGT_EXLS_CLS_CODE: '000000',
      FID_INPUT_PRICE_1: priceMin || '10',
      FID_INPUT_PRICE_2: priceMax || '999',
      FID_VOL_CNT: '100000',
      FID_INPUT_DATE_1: ''
    });

    const response = await fetch(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/volume-rank?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey': appKey,
          'appsecret': appSecret,
          'tr_id': 'FHPST01710000',
          'custtype': 'P'
        }
      }
    );

    const data = await response.json();
    
    if (data.rt_cd === '0') {
      res.json({ success: true, data: data.output || [] });
    } else {
      res.status(400).json({ error: data.msg1 || '조회 실패' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 등락률 상위 종목 조회
app.post('/api/change-rank', async (req, res) => {
  try {
    const { appKey, appSecret, priceMin, priceMax, isUp } = req.body;
    const token = await getAccessToken(appKey, appSecret);

    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: 'J',
      FID_COND_SCR_DIV_CODE: '20170',
      FID_INPUT_ISCD: '0000',
      FID_DIV_CLS_CODE: isUp ? '0' : '1',
      FID_BLNG_CLS_CODE: '0',
      FID_TRGT_CLS_CODE: '111111111',
      FID_TRGT_EXLS_CLS_CODE: '000000',
      FID_INPUT_PRICE_1: priceMin || '10',
      FID_INPUT_PRICE_2: priceMax || '999',
      FID_VOL_CNT: '10000',
      FID_INPUT_DATE_1: ''
    });

    const response = await fetch(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/chgrate-rank?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey': appKey,
          'appsecret': appSecret,
          'tr_id': 'FHPST01700000',
          'custtype': 'P'
        }
      }
    );

    const data = await response.json();
    
    if (data.rt_cd === '0') {
      res.json({ success: true, data: data.output || [] });
    } else {
      res.status(400).json({ error: data.msg1 || '조회 실패' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 일봉 차트 데이터 조회
app.post('/api/daily-chart', async (req, res) => {
  try {
    const { appKey, appSecret, stockCode } = req.body;
    const token = await getAccessToken(appKey, appSecret);

    const today = new Date();
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    today.setMonth(today.getMonth() - 3);
    const startDate = today.toISOString().slice(0, 10).replace(/-/g, '');

    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: 'J',
      FID_INPUT_ISCD: stockCode,
      FID_INPUT_DATE_1: startDate,
      FID_INPUT_DATE_2: endDate,
      FID_PERIOD_DIV_CODE: 'D',
      FID_ORG_ADJ_PRC: '0'
    });

    const response = await fetch(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey': appKey,
          'appsecret': appSecret,
          'tr_id': 'FHKST03010100'
        }
      }
    );

    const data = await response.json();
    
    if (data.rt_cd === '0') {
      res.json({ success: true, data: data.output2 || [] });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 현재가 조회
app.post('/api/price', async (req, res) => {
  try {
    const { appKey, appSecret, stockCode } = req.body;
    const token = await getAccessToken(appKey, appSecret);

    const response = await fetch(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey': appKey,
          'appsecret': appSecret,
          'tr_id': 'FHKST01010100'
        }
      }
    );

    const data = await response.json();
    
    if (data.rt_cd === '0') {
      res.json({ success: true, data: data.output });
    } else {
      res.status(400).json({ error: data.msg1 || '조회 실패' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
