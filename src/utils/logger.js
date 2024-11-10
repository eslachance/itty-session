export const log = (doLog, level, ...message) => {
  if(Array.isArray(level)) {
    message = level;
    level = 'log';
  }
  if(doLog) {
    console[level](`[${new Date().toISOString()}: ${level}]`, ...message);
  }
}
