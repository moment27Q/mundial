/**
 * Stress Test - World Cup Predictor
 * Tool: k6 (https://k6.io)
 *
 * Run:
 *   k6 run stress-tests/k6-test.js
 *   k6 run --vus 50 --duration 60s stress-tests/k6-test.js
 *   k6 run --vus 200 --duration 120s stress-tests/k6-test.js   # stress test
 *
 * Scenarios defined below:
 *  1. smoke       - 1 VU, 30s  — sanity check
 *  2. load        - ramp to 50 VUs, 5min
 *  3. stress      - ramp to 200 VUs, 10min
 *  4. spike       - sudden spike to 500 VUs for 30s
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

const loginDuration = new Trend('login_duration');
const predictionDuration = new Trend('prediction_duration');
const leaderboardDuration = new Trend('leaderboard_duration');
const failedRequests = new Counter('failed_requests');
const successRate = new Rate('success_rate');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      startTime: '35s',
      tags: { scenario: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      startTime: '6m',
      tags: { scenario: 'stress' },
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
      startTime: '15m30s',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],
    success_rate: ['rate>0.95'],
    login_duration: ['p(95)<600'],
    leaderboard_duration: ['p(95)<300'],
  },
};

// --- Helpers ---

function randomUser() {
  const id = Math.floor(Math.random() * 100000);
  return {
    username: `testuser${id}`,
    email: `testuser${id}@stress.test`,
    password: 'password123',
  };
}

function registerAndLogin() {
  const user = randomUser();
  const params = { headers: { 'Content-Type': 'application/json' } };

  // Register
  const regRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(user), params);
  if (regRes.status === 201) {
    return JSON.parse(regRes.body).token;
  }

  // Fallback: login as admin (pre-seeded)
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'admin@worldcup.com',
    password: 'admin123',
  }), params);

  if (loginRes.status === 200) {
    return JSON.parse(loginRes.body).token;
  }
  return null;
}

function authHeaders(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

// --- Main scenario ---

export default function () {
  let token;

  group('1. Auth', function () {
    const start = Date.now();
    token = registerAndLogin();
    loginDuration.add(Date.now() - start);

    const ok = token !== null;
    check(token, { 'auth token obtained': t => t !== null });
    successRate.add(ok);
    if (!ok) failedRequests.add(1);
  });

  if (!token) return;

  const headers = authHeaders(token);

  group('2. Fetch matches', function () {
    const res = http.get(`${BASE_URL}/api/matches`, headers);
    const ok = check(res, {
      'GET /matches status 200': r => r.status === 200,
      'matches is array': r => { try { return Array.isArray(JSON.parse(r.body)); } catch { return false; } },
    });
    successRate.add(ok);
    if (!ok) failedRequests.add(1);
    sleep(0.5);
  });

  group('3. Leaderboard', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/leaderboard`, headers);
    leaderboardDuration.add(Date.now() - start);
    const ok = check(res, { 'GET /leaderboard 200': r => r.status === 200 });
    successRate.add(ok);
    if (!ok) failedRequests.add(1);
    sleep(0.3);
  });

  group('4. My predictions', function () {
    const res = http.get(`${BASE_URL}/api/predictions/my`, headers);
    const ok = check(res, { 'GET /predictions/my 200': r => r.status === 200 });
    successRate.add(ok);
    if (!ok) failedRequests.add(1);
    sleep(0.3);
  });

  group('5. Submit prediction', function () {
    // Get first upcoming match
    const matchesRes = http.get(`${BASE_URL}/api/matches?status=upcoming`, headers);
    if (matchesRes.status !== 200) return;

    let matches;
    try { matches = JSON.parse(matchesRes.body); } catch { return; }
    if (!matches.length) return;

    const match = matches[0];
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/predictions`,
      JSON.stringify({ match_id: match.id, home_score: Math.floor(Math.random() * 5), away_score: Math.floor(Math.random() * 5) }),
      headers
    );
    predictionDuration.add(Date.now() - start);

    const ok = check(res, { 'POST /predictions 200|400': r => r.status === 200 || r.status === 400 });
    successRate.add(ok);
    if (!ok) failedRequests.add(1);
    sleep(0.5);
  });

  group('6. My rooms', function () {
    const res = http.get(`${BASE_URL}/api/rooms/my`, headers);
    const ok = check(res, { 'GET /rooms/my 200': r => r.status === 200 });
    successRate.add(ok);
    if (!ok) failedRequests.add(1);
  });

  group('7. Health check', function () {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, { 'health 200': r => r.status === 200 });
  });

  sleep(1);
}
