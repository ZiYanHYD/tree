/**
 * Jest 测试环境设置文件
 * 配置全局mock和测试环境
 */

// 模拟浏览器API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now())
  }
});

// 模拟console方法以避免测试输出干扰
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 模拟setTimeout和setInterval
global.setTimeout = jest.fn((fn, delay) => {
  return setTimeout(fn, delay);
});

global.clearTimeout = jest.fn((id) => {
  return clearTimeout(id);
});

// 模拟Math.hypot
Math.hypot = jest.fn((...args) => {
  return Math.sqrt(args.reduce((sum, val) => sum + val * val, 0));
});

// 模拟Date.now
Date.now = jest.fn(() => 1640000000000);

// 设置默认测试超时
jest.setTimeout(10000);