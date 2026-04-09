import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { AppConfig, AppSettings } from '../../src/shared/contracts';

const DEFAULT_SETTINGS: AppSettings = {
  showAdvancedMode: false,
  showBeginnerGuide: true,
  autoSnapshotBeforeRestore: true,
  autoSnapshotBeforeMerge: true,
  defaultSaveMessageTemplate: '',
  language: 'auto'
};

const DEFAULT_CONFIG: AppConfig = {
  recentProjects: [],
  settings: DEFAULT_SETTINGS
};

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

async function ensureConfigFile() {
  const filePath = getConfigPath();
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  }
  return filePath;
}

async function readConfig(): Promise<AppConfig> {
  const filePath = await ensureConfigFile();
  const text = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(text) as Partial<AppConfig>;
  const rawLanguage = parsed.settings?.language;
  const language =
    rawLanguage === 'zh-CN' || rawLanguage === 'en-US' || rawLanguage === 'auto'
      ? rawLanguage
      : DEFAULT_SETTINGS.language;
  return {
    recentProjects: Array.isArray(parsed.recentProjects) ? parsed.recentProjects : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(parsed.settings ?? {}),
      language
    }
  };
}

async function writeConfig(config: AppConfig) {
  const filePath = await ensureConfigFile();
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
}

export async function getConfig() {
  return readConfig();
}

export async function addRecentProject(projectPath: string) {
  const config = await readConfig();
  const nextRecent = [projectPath, ...config.recentProjects.filter((item) => item !== projectPath)].slice(
    0,
    10
  );
  const nextConfig: AppConfig = {
    ...config,
    recentProjects: nextRecent
  };
  await writeConfig(nextConfig);
  return nextConfig;
}

export async function updateSettings(partial: Partial<AppSettings>) {
  const config = await readConfig();
  const nextConfig: AppConfig = {
    ...config,
    settings: {
      ...config.settings,
      ...partial
    }
  };
  await writeConfig(nextConfig);
  return nextConfig.settings;
}
