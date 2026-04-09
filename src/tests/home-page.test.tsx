import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { HomePage } from '../pages/HomePage';
import { useAppStore } from '../stores/useAppStore';

const defaultActions = {
  openProjectFolder: async () => undefined,
  openCloneProjectDialog: async () => undefined,
  openProjectByPath: async () => undefined,
  enableProtection: async () => undefined,
  refreshProject: async () => undefined,
  refreshConfig: async () => undefined
};

function createBridgeMock() {
  return {
    chooseProjectFolder: vi.fn(),
    chooseCloneDestination: vi.fn(),
    openProject: vi.fn(),
    cloneProjectFromGitHub: vi.fn(),
    enableProtection: vi.fn(),
    getCurrentChanges: vi.fn(),
    saveProgress: vi.fn(),
    listHistory: vi.fn(),
    listSafetyBackups: vi.fn(),
    restoreToRecord: vi.fn(),
    restoreToSafetyBackup: vi.fn(),
    listPlans: vi.fn(),
    createPlan: vi.fn(),
    switchPlan: vi.fn(),
    mergePlan: vi.fn(),
    resolveCollision: vi.fn(),
    completeMerge: vi.fn(),
    getConfig: vi.fn(),
    updateSettings: vi.fn(),
    checkGitEnvironment: vi.fn(),
    getGitHubAuthStatus: vi.fn(),
    loginGitHub: vi.fn(),
    logoutGitHub: vi.fn(),
    getCloudSyncStatus: vi.fn(),
    testCloudConnection: vi.fn(),
    connectCloud: vi.fn(),
    uploadToCloud: vi.fn(),
    getCloudLatest: vi.fn(),
    exportLogs: vi.fn(),
    openExternalUrl: vi.fn()
  };
}

function renderHomePage(
  locale: 'en-US' | 'zh-CN',
  actions: typeof defaultActions = defaultActions
) {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={actions}>
          <HomePage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: null,
      notice: null,
      config: null
    });
    window.tapgit = undefined as never;
  });

  afterEach(() => {
    cleanup();
    window.tapgit = undefined as never;
  });

  it('shows two clear entry cards in Chinese mode when no project is open', () => {
    useAppStore.setState({
      project: null,
      notice: null,
      config: {
        recentProjects: [],
        settings: {
          showAdvancedMode: false,
          showBeginnerGuide: false,
          autoSnapshotBeforeRestore: true,
          autoSnapshotBeforeMerge: true,
          defaultSaveMessageTemplate: '',
          language: 'zh-CN'
        }
      }
    });

    renderHomePage('zh-CN');

    expect(screen.getByText('先选一个项目开始')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开本地项目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从 GitHub 获取项目' })).toBeInTheDocument();
    expect(screen.getByText('最近项目')).toBeInTheDocument();
  });

  it('opens the GitHub import flow from the primary entry card', async () => {
    const user = userEvent.setup();
    const openCloneProjectDialog = vi.fn(async () => undefined);

    useAppStore.setState({
      project: null,
      notice: null,
      config: {
        recentProjects: [],
        settings: {
          showAdvancedMode: false,
          showBeginnerGuide: false,
          autoSnapshotBeforeRestore: true,
          autoSnapshotBeforeMerge: true,
          defaultSaveMessageTemplate: '',
          language: 'en-US'
        }
      }
    });

    renderHomePage('en-US', {
      ...defaultActions,
      openCloneProjectDialog
    });

    await user.click(screen.getByRole('button', { name: 'Get from GitHub' }));

    expect(openCloneProjectDialog).toHaveBeenCalledTimes(1);
  });

  it('shows one clear next step after a project is already open', async () => {
    const bridge = createBridgeMock();
    bridge.listHistory.mockResolvedValue({ ok: true, data: [] });
    window.tapgit = bridge as never;

    useAppStore.setState({
      project: {
        path: 'E:/demo/project-a',
        name: 'project-a',
        isProtected: true,
        currentPlan: 'main',
        pendingChangeCount: 3
      },
      notice: null,
      config: {
        recentProjects: [],
        settings: {
          showAdvancedMode: false,
          showBeginnerGuide: false,
          autoSnapshotBeforeRestore: true,
          autoSnapshotBeforeMerge: true,
          defaultSaveMessageTemplate: '',
          language: 'en-US'
        }
      }
    });

    renderHomePage('en-US');

    expect(screen.getByText('Project is ready')).toBeInTheDocument();
    expect(screen.getByText('What to do next')).toBeInTheDocument();
    expect(screen.getByText('Save a stable point before you keep going')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review Changes' })).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.listHistory).toHaveBeenCalledWith('E:/demo/project-a');
    });
  });
});
