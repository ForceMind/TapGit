import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function getLogFilePath() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  const logFile = path.join(logDir, 'tapgit.log');
  return { logDir, logFile };
}

export async function writeLog(level: LogLevel, action: string, detail?: string) {
  const { logDir, logFile } = getLogFilePath();
  const time = new Date().toISOString();
  const line = `[${time}] [${level}] [${action}] ${detail ?? ''}\n`;
  await fs.mkdir(logDir, { recursive: true });
  await fs.appendFile(logFile, line, 'utf8');
}

export async function logInfo(action: string, detail?: string) {
  await writeLog('INFO', action, detail);
}

export async function logWarn(action: string, detail?: string) {
  await writeLog('WARN', action, detail);
}

export async function logError(action: string, detail?: string) {
  await writeLog('ERROR', action, detail);
}

export function getCurrentLogFilePath() {
  return getLogFilePath().logFile;
}
