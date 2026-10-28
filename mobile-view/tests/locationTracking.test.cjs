const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadService(name, dependencies, globals) {
  const filename = path.join(__dirname, '../src/services', `${name}.ts`);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (dependency) => {
      if (!(dependency in dependencies)) throw new Error(`Unexpected dependency: ${dependency}`);
      return dependencies[dependency];
    },
    ...globals,
  }, { filename });
  return module.exports;
}

function setup(t) {
  const state = { permission: { status: 'denied', canAskAgain: true } };
  const position = { coords: { latitude: 17.4, longitude: 78.5 } };
  const expo = {
    Accuracy: { Balanced: 3 },
    getForegroundPermissionsAsync: t.mock.fn(async () => state.permission),
    requestForegroundPermissionsAsync: t.mock.fn(async () => state.permission),
    getCurrentPositionAsync: t.mock.fn(async () => position),
    getLastKnownPositionAsync: t.mock.fn(async () => position),
  };
  const post = t.mock.fn(async () => ({}));
  const logs = { warn: t.mock.fn(), error: t.mock.fn() };
  const timeouts = new Map();
  const intervals = new Map();
  const listeners = new Set();
  let timer = 0;
  const globals = {
    console: logs,
    setTimeout: (callback) => { const id = ++timer; timeouts.set(id, callback); return id; },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (callback) => { const id = ++timer; intervals.set(id, callback); return id; },
    clearInterval: (id) => intervals.delete(id),
  };
  const AppState = {
    currentState: 'active',
    addEventListener: (_, callback) => {
      listeners.add(callback);
      return { remove: () => listeners.delete(callback) };
    },
  };
  const api = { apiService: { post } };
  const location = loadService('location', { 'expo-location': expo, './api': api }, globals);
  const tracking = loadService('tracking', {
    'react-native': { AppState }, './api': api, './location': location,
  }, globals);
  t.after(() => tracking.stopForegroundTracking());
  function changeAppState(next) {
    AppState.currentState = next;
    listeners.forEach((callback) => callback(next));
  }
  return { state, expo, post, logs, timeouts, intervals, location, tracking, changeAppState };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('automatic tracking quietly skips denied permission without requesting access or GPS', async (t) => {
  const h = setup(t);
  h.tracking.startForegroundTracking();
  await settle();
  h.intervals.forEach((callback) => callback());
  await settle();
  assert.equal(h.expo.requestForegroundPermissionsAsync.mock.callCount(), 0);
  assert.equal(h.expo.getCurrentPositionAsync.mock.callCount(), 0);
  assert.equal(h.post.mock.callCount(), 0);
  assert.equal(h.logs.error.mock.callCount(), 0);
  assert.equal(h.logs.warn.mock.callCount(), 0);
});

test('explicit location capture can request permission and succeeds after approval', async (t) => {
  const h = setup(t);
  h.expo.requestForegroundPermissionsAsync.mock.mockImplementation(async () => ({ status: 'granted', canAskAgain: true }));
  const result = await h.location.getCurrentLocation();
  assert.equal(result.latitude, 17.4);
  assert.equal(result.longitude, 78.5);
  assert.equal(h.expo.requestForegroundPermissionsAsync.mock.callCount(), 1);
  assert.equal(h.timeouts.size, 0);
});

test('permanently denied permission gives settings instructions without another prompt', async (t) => {
  const h = setup(t);
  h.state.permission.canAskAgain = false;
  await assert.rejects(h.location.getCurrentLocation(), (error) => {
    assert.ok(error instanceof h.location.LocationPermissionError);
    assert.match(error.message, /phone settings/);
    return true;
  });
  assert.equal(h.expo.requestForegroundPermissionsAsync.mock.callCount(), 0);
  assert.equal(h.expo.getCurrentPositionAsync.mock.callCount(), 0);
  assert.equal(h.logs.error.mock.callCount(), 0);
});

test('tracking resumes on return from settings after permission is granted', async (t) => {
  const h = setup(t);
  h.tracking.startForegroundTracking();
  await settle();
  h.changeAppState('background');
  assert.equal(h.intervals.size, 0);
  h.state.permission.status = 'granted';
  h.changeAppState('active');
  await settle();
  assert.equal(h.post.mock.callCount(), 1);
  const [endpoint, payload] = h.post.mock.calls[0].arguments;
  assert.equal(endpoint, '/tracking/ping');
  assert.equal(payload.latitude, 17.4);
  assert.equal(payload.source, 'foreground');
  assert.equal(h.expo.requestForegroundPermissionsAsync.mock.callCount(), 0);
});

test('foreground-only tracking never captures a background ping', async (t) => {
  const h = setup(t);
  h.state.permission.status = 'granted';
  h.changeAppState('background');
  assert.equal(await h.tracking.sendLocationPing('background'), false);
  assert.equal(await h.tracking.sendLocationPing('foreground'), false);
  assert.equal(h.expo.getCurrentPositionAsync.mock.callCount(), 0);
  assert.equal(h.post.mock.callCount(), 0);
});

test('a GPS fix completing after backgrounding is not uploaded', async (t) => {
  const h = setup(t);
  h.state.permission.status = 'granted';
  let finishFix;
  h.expo.getCurrentPositionAsync.mock.mockImplementation(() => new Promise((resolve) => { finishFix = resolve; }));
  const pending = h.tracking.sendLocationPing('foreground');
  await settle();
  h.changeAppState('background');
  finishFix({ coords: { latitude: 17.4, longitude: 78.5 } });
  assert.equal(await pending, false);
  assert.equal(h.post.mock.callCount(), 0);
  assert.equal(h.timeouts.size, 0);
});

test('GPS timeout retains the last-known-location fallback and clears its timer', async (t) => {
  const h = setup(t);
  h.state.permission.status = 'granted';
  h.expo.getCurrentPositionAsync.mock.mockImplementation(() => new Promise(() => {}));
  const pending = h.location.getCurrentLocation();
  await settle();
  h.timeouts.forEach((callback) => callback());
  const result = await pending;
  assert.equal(result.latitude, 17.4);
  assert.equal(h.expo.getLastKnownPositionAsync.mock.callCount(), 1);
  assert.equal(h.timeouts.size, 0);
});

test('network errors are still reported rather than treated as permission denial', async (t) => {
  const h = setup(t);
  h.state.permission.status = 'granted';
  h.post.mock.mockImplementation(async () => { throw new Error('Network unavailable'); });
  assert.equal(await h.tracking.sendLocationPing('foreground'), false);
  assert.equal(h.logs.warn.mock.callCount(), 1);
  assert.match(h.logs.warn.mock.calls[0].arguments[1], /Network unavailable/);
});
