// 通用工具函数

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 深拷贝对象
 * @param {any} obj 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 格式化时间戳为时间字符串
 * @param {number} timestamp 时间戳
 * @param {string} format 格式化模板
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化数字，添加千分位
 * @param {number} num 要格式化的数字
 * @returns {string} 格式化后的数字字符串
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 防抖函数
 * @param {Function} func 要执行的函数
 * @param {number} delay 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} func 要执行的函数
 * @param {number} delay 延迟时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, delay) {
  let lastTime = 0;
  return function (...args) {
    const currentTime = Date.now();
    if (currentTime - lastTime > delay) {
      func.apply(this, args);
      lastTime = currentTime;
    }
  };
}

/**
 * 存储数据到本地存储
 * @param {string} key 存储键名
 * @param {any} value 存储值
 */
export function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // console.error('Error setting localStorage:', error);
  }
}

/**
 * 从本地存储获取数据
 * @param {string} key 存储键名
 * @param {any} defaultValue 默认值
 * @returns {any} 获取的数据
 */
export function getLocalStorage(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch {
    // console.error('Error getting localStorage:', error);
    return defaultValue;
  }
}

/**
 * 从本地存储删除数据
 * @param {string} key 存储键名
 */
export function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // console.error('Error removing localStorage:', error);
  }
}

/**
 * 清空本地存储
 */
export function clearLocalStorage() {
  try {
    localStorage.clear();
  } catch {
    // console.error('Error clearing localStorage:', error);
  }
}

/**
 * 下载文件
 * @param {string} content 文件内容
 * @param {string} fileName 文件名
 * @param {string} contentType 文件类型
 */
export function downloadFile(
  content,
  fileName,
  contentType = 'application/json'
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 读取文件
 * @param {File} file 文件对象
 * @returns {Promise<string>} 文件内容
 */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      resolve(e.target.result);
    };
    reader.onerror = e => {
      reject(e);
    };
    reader.readAsText(file);
  });
}

/**
 * 检查对象是否为空
 * @param {object} obj 要检查的对象
 * @returns {boolean} 是否为空
 */
export function isEmpty(obj) {
  if (obj === null || obj === undefined) {
    return true;
  }
  if (typeof obj === 'string') {
    return obj.trim() === '';
  }
  if (obj instanceof Array) {
    return obj.length === 0;
  }
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }
  return false;
}

/**
 * 检查值是否为数字
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为数字
 */
export function isNumber(value) {
  return !isNaN(value) && typeof value === 'number';
}

/**
 * 检查值是否为字符串
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为字符串
 */
export function isString(value) {
  return typeof value === 'string';
}

/**
 * 检查值是否为布尔值
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为布尔值
 */
export function isBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * 检查值是否为数组
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为数组
 */
export function isArray(value) {
  return Array.isArray(value);
}

/**
 * 检查值是否为对象
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为对象
 */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 检查值是否为函数
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为函数
 */
export function isFunction(value) {
  return typeof value === 'function';
}

/**
 * 检查值是否为 undefined
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为 undefined
 */
export function isUndefined(value) {
  return value === undefined;
}

/**
 * 检查值是否为 null
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为 null
 */
export function isNull(value) {
  return value === null;
}

/**
 * 检查值是否为 null 或 undefined
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为 null 或 undefined
 */
export function isNil(value) {
  return value === null || value === undefined;
}

/**
 * 检查值是否为 truthy
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为 truthy
 */
export function isTruthy(value) {
  return !!value;
}

/**
 * 检查值是否为 falsy
 * @param {any} value 要检查的值
 * @returns {boolean} 是否为 falsy
 */
export function isFalsy(value) {
  return !value;
}
