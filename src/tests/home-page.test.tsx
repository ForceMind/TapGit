import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { HomePage } from '../pages/HomePage';
import { useAppStore } from '../stores/useAppStore';

const defaultActions = {
  openProjectFolder: async () => undefined,
  openProjectByPath: async () => undefined,
  enableProtection: async () => undefined,
  refreshProject: async () => undefined,
  refreshConfig: async () => undefined
};

function createBridgeMock() {
  return {
    chooseProjectFolder: vi.fn(),
    openProject: vi.fn(),
    enableProtection: vi.fn(),
    getCurrentChanges: vi.fn(),
    saveProgress: vi.fn(),
    listHistory: vi.fn(),
    restoreToRecord: vi.fn(),
    listPlans: vi.fn(),
    createPlan: vi.fn(),
    switchPlan: vi.fn(),
    mergePlan: vi.fn(),
    resolveCollision: vi.fn(),
    completeMerge: vi.fn(),
    getConfig: vi.fn(),
    updateSettings: vi.fn(),
    checkGitEnvironment: vi.fn(),
    getCloudSyncStatus: vi.fn(),
    testCloudConnection: vi.fn(),
    connectCloud: vi.fn(),
    uploadToCloud: vi.fn(),
    getCloudLatest: vi.fn(),
    exportLogs: vi.fn()
  };
}

function renderHomePage(locale: 'en-US' | 'zh-CN') {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={defaultActions}>
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

  it('shows recent projects in Chinese mode', () => {
    useAppStore.setState({
      project: null,
      notice: null,
      config: {
        recentProjects: ['E:/demo/project-a', 'E:/demo/project-b'],
        settings: {
          showAdvancedMode: false,
          showBeginnerGuide: true,
          autoSnapshotBeforeRestore: true,
          autoSnapshotBeforeMerge: true,
          defaultSaveMessageTemplate: '',
          language: 'zh-CN'
        }
      }
    });

    renderHomePage('zh-CN');

    expect(screen.getByText('最近项目')).toBeInTheDocument();
    expect(screen.getByText('project-a')).toBeInTheDocument();
    expect(screen.getByText('project-b')).toBeInTheDocument();
  });

  it('shows next-step cards for a protected project', async () => {
    const bridge = createBridgeMock();
    bridge.listHistory.mockResolvedValue({ ok: true, data: [] });
    bridge.getCloudSyncStatus.mockResolvedValue({
      ok: true,
      data: {
        connected: false,
        remoteLabel: '',
        remoteUrl: '',
        currentPlan: 'main',
        hasTracking: false,
        pendingUpload: 0,
        pendingDownload: 0,
        statusText: ''
      }
    });
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

    expect(screen.getByText('What to do next')).toBeInTheDocument();
    expect(
      await screen.findByText('You currently have 3 unsaved files. Save once to keep a stable point.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Connect a cloud address when you want a backup outside this device.')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.listHistory).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.getCloudSyncStatus).toHaveBeenCalledWith('E:/demo/project-a');
    });
  });
});
