import { createContext, ReactNode, useContext, useMemo } from 'react';
import { BridgeError } from '../services/bridge';
import {
  AppLanguagePreference,
  AppLocale,
  CloudConnectionCode,
  CloudConnectionTestResult,
  CloudSyncStatus
} from '../shared/contracts';
import { EN_MESSAGES, MessageKey, ZH_MESSAGES } from './messages';

type Interpolation = Record<string, string | number>;
type Translator = (key: MessageKey, interpolation?: Interpolation) => string;

interface I18nContextValue {
  locale: AppLocale;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en-US',
  t: createTranslator('en-US')
});

const ERROR_KEY_MAP: Partial<Record<string, MessageKey>> = {
  BRIDGE_NOT_AVAILABLE: 'error_bridge_not_available',
  UNKNOWN_ERROR: 'error_unknown',
  PROTECTION_NOT_ENABLED: 'error_protection_not_enabled',
  PENDING_CHANGES: 'error_pending_changes',
  EMPTY_MESSAGE: 'error_empty_message',
  NOTHING_TO_SAVE: 'error_nothing_to_save',
  SAVE_FAILED: 'error_save_failed',
  NO_HISTORY: 'error_no_history',
  RESTORE_FAILED: 'error_restore_failed',
  INVALID_PLAN_NAME: 'error_invalid_plan_name',
  CREATE_PLAN_FAILED: 'error_create_plan_failed',
  SWITCH_PLAN_FAILED: 'error_switch_plan_failed',
  MERGE_FAILED: 'error_merge_failed',
  MANUAL_CONTENT_REQUIRED: 'error_manual_content_required',
  COMPLETE_MERGE_FAILED: 'error_complete_merge_failed',
  EMPTY_REMOTE_URL: 'error_empty_remote_url',
  CONNECT_CLOUD_FAILED: 'error_connect_cloud_failed',
  GITHUB_LOGIN_FAILED: 'error_github_login_failed',
  GITHUB_LOGOUT_FAILED: 'error_github_logout_failed',
  CLOUD_NOT_CONNECTED: 'error_cloud_not_connected',
  NO_REMOTE_RECORD: 'error_no_remote_record',
  UPLOAD_FAILED: 'error_upload_failed',
  GET_LATEST_FAILED: 'error_get_latest_failed'
};

const CLOUD_ADVICE_KEY_MAP: Partial<Record<string, MessageKey>> = {
  EMPTY_REMOTE_URL: 'settings_advice_empty_remote',
  CONNECT_CLOUD_FAILED: 'settings_advice_connect_failed',
  CLOUD_NOT_CONNECTED: 'settings_advice_not_connected',
  NO_REMOTE_RECORD: 'settings_advice_no_remote_record',
  PENDING_CHANGES: 'settings_advice_pending_changes',
  UPLOAD_FAILED: 'settings_advice_upload_failed',
  GET_LATEST_FAILED: 'settings_advice_get_latest_failed'
};

const CLOUD_TEST_KEY_MAP: Record<CloudConnectionCode, MessageKey> = {
  ok: 'settings_cloud_test_success',
  auth_required: 'settings_cloud_test_auth',
  not_found: 'settings_cloud_test_not_found',
  network_error: 'settings_cloud_test_network',
  unknown_error: 'settings_cloud_test_unknown'
};

export const DIFF_TOKENS = {
  EMPTY_FILE: '__TAPGIT_EMPTY_FILE__',
  NO_DETAIL: '__TAPGIT_NO_DIFF_DETAIL__',
  UNSTAGED_SPLIT: '__TAPGIT_UNSTAGED_CHANGES__'
} as const;

export const CONFLICT_TOKENS = {
  UNREADABLE_CURRENT: '__TAPGIT_UNREADABLE_CURRENT__',
  UNREADABLE_INCOMING: '__TAPGIT_UNREADABLE_INCOMING__'
} as const;

function isChineseLanguage(language: string) {
  return language.toLowerCase().startsWith('zh');
}

export function resolveLocale(
  preference: AppLanguagePreference | undefined,
  systemLanguage?: string
): AppLocale {
  if (preference === 'zh-CN' || preference === 'en-US') {
    return preference;
  }

  if (systemLanguage && isChineseLanguage(systemLanguage)) {
    return 'zh-CN';
  }

  if (typeof navigator !== 'undefined' && isChineseLanguage(navigator.language)) {
    return 'zh-CN';
  }

  return 'en-US';
}

function interpolate(template: string, interpolation?: Interpolation) {
  if (!interpolation) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = interpolation[key];
    return value === undefined ? '' : String(value);
  });
}

function createTranslator(locale: AppLocale): Translator {
  const dict = locale === 'zh-CN' ? ZH_MESSAGES : EN_MESSAGES;
  return (key, interpolation) => interpolate(dict[key] ?? EN_MESSAGES[key], interpolation);
}

export function I18nProvider({
  locale,
  children
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: createTranslator(locale)
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function toPlanLabel(planName: string, isMain: boolean, t: Translator) {
  if (isMain || planName === 'main' || planName === 'master') {
    return t('common_main_plan');
  }
  return planName;
}

export function toCloudStatusText(status: CloudSyncStatus, t: Translator) {
  if (!status.connected) {
    return t('cloud_not_connected');
  }
  if (!status.hasTracking) {
    return t('cloud_connected_no_tracking');
  }
  if (status.pendingUpload === 0 && status.pendingDownload === 0) {
    return t('cloud_synced');
  }
  if (status.pendingUpload > 0 && status.pendingDownload > 0) {
    return t('cloud_pending_both', {
      upload: status.pendingUpload,
      download: status.pendingDownload
    });
  }
  if (status.pendingUpload > 0) {
    return t('cloud_pending_upload_only', { upload: status.pendingUpload });
  }
  return t('cloud_pending_download_only', { download: status.pendingDownload });
}

export function toLocalizedErrorMessage(
  error: unknown,
  t: Translator,
  fallbackKey: MessageKey
) {
  if (error instanceof BridgeError) {
    const key = ERROR_KEY_MAP[error.code];
    if (key) {
      return t(key);
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t(fallbackKey);
}

export function toCloudAdvice(error: unknown, t: Translator) {
  if (!(error instanceof BridgeError)) return '';
  const key = CLOUD_ADVICE_KEY_MAP[error.code];
  return key ? t(key) : '';
}

export function toCloudTestMessage(result: CloudConnectionTestResult, t: Translator) {
  return t(CLOUD_TEST_KEY_MAP[result.code]);
}

export function toChangeStatusLabel(
  changeType: 'added' | 'modified' | 'deleted' | 'renamed',
  t: Translator
) {
  switch (changeType) {
    case 'added':
      return t('changes_status_added');
    case 'modified':
      return t('changes_status_modified');
    case 'deleted':
      return t('changes_status_deleted');
    case 'renamed':
      return t('changes_status_renamed');
    default:
      return t('changes_status_modified');
  }
}

export function toLocalizedDiffText(diffText: string, t: Translator) {
  if (diffText === DIFF_TOKENS.EMPTY_FILE) {
    return t('changes_diff_empty_file');
  }
  if (diffText === DIFF_TOKENS.NO_DETAIL) {
    return t('changes_diff_no_detail');
  }
  return diffText.replace(DIFF_TOKENS.UNSTAGED_SPLIT, t('changes_diff_staged_split'));
}

export function toLocalizedConflictContent(
  content: string,
  type: 'current' | 'incoming',
  t: Translator
) {
  if (content === CONFLICT_TOKENS.UNREADABLE_CURRENT) {
    return t('plans_conflict_unreadable_current');
  }
  if (content === CONFLICT_TOKENS.UNREADABLE_INCOMING) {
    return t('plans_conflict_unreadable_incoming');
  }
  if (type === 'current' && content === CONFLICT_TOKENS.UNREADABLE_INCOMING) {
    return t('plans_conflict_unreadable_current');
  }
  if (type === 'incoming' && content === CONFLICT_TOKENS.UNREADABLE_CURRENT) {
    return t('plans_conflict_unreadable_incoming');
  }
  return content;
}
