const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const DEFAULT_LEVEL = 'info';

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
};

const resolveLevel = () => {
  if (typeof window === 'undefined') return DEFAULT_LEVEL;
  const explicit = typeof window.WL_LOG_LEVEL === 'string' ? window.WL_LOG_LEVEL : null;
  if (explicit && LOG_LEVELS[explicit]) return explicit;
  const storage = getStorage();
  const stored = storage ? storage.getItem('wl-log-level') : null;
  if (stored && LOG_LEVELS[stored]) return stored;
  return DEFAULT_LEVEL;
};

let activeLevel = resolveLevel();

const shouldLog = (level) => LOG_LEVELS[level] >= LOG_LEVELS[activeLevel];

const formatMessage = (scope, message) => {
  const tag = scope ? `[${scope}]` : '[App]';
  return message ? `${tag} ${message}` : tag;
};

const logWith = (level, scope, message, data) => {
  if (!shouldLog(level)) return;
  const text = formatMessage(scope, message);
  const method = level === 'debug'
    ? console.debug
    : (level === 'info' ? console.log : (level === 'warn' ? console.warn : console.error));
  if (data !== undefined) {
    method(text, data);
  } else {
    method(text);
  }
};

const createLogger = (scope) => ({
  debug: (message, data) => logWith('debug', scope, message, data),
  info: (message, data) => logWith('info', scope, message, data),
  warn: (message, data) => logWith('warn', scope, message, data),
  error: (message, data) => logWith('error', scope, message, data)
});

const setLevel = (level) => {
  if (!LOG_LEVELS[level]) return;
  activeLevel = level;
  const storage = getStorage();
  if (storage) storage.setItem('wl-log-level', level);
};

const getLevel = () => activeLevel;

if (typeof window !== 'undefined') {
  window.WLLogger = window.WLLogger || {};
  window.WLLogger.setLevel = setLevel;
  window.WLLogger.getLevel = getLevel;
}

export { createLogger, setLevel, getLevel };
