import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { PlansPage } from '../pages/PlansPage';
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

function renderPlansPage(locale: 'en-US' | 'zh-CN') {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={defaultActions}>
          <PlansPage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('PlansPage', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: {
        path: 'E:/demo/project-a',
        name: 'project-a',
        isProtected: true,
        currentPlan: 'main',
        pendingChangeCount: 0
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
    window.tapgit = undefined as never;
  });

  afterEach(() => {
    cleanup();
    window.tapgit = undefined as never;
  });

  it('locks idea actions until the first saved record exists', async () => {
    const bridge = createBridgeMock();
    bridge.listPlans.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'main',
          name: 'main',
          isCurrent: true,
          isMain: true,
          lastSavedAt: null,
          lastMessage: ''
        }
      ]
    });
    bridge.listHistory.mockResolvedValue({ ok: true, data: [] });
    window.tapgit = bridge as never;

    renderPlansPage('en-US');

    expect(await screen.findByText('Save one stable version first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start This Idea' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Go Save Current Work' })).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.listPlans).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.listHistory).toHaveBeenCalledWith('E:/demo/project-a');
    });
  });

  it('separates the stable version from idea copies once the project is ready', async () => {
    const bridge = createBridgeMock();
    bridge.listPlans.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'main',
          name: 'main',
          isCurrent: true,
          isMain: true,
          lastSavedAt: 1712636100,
          lastMessage: 'Stable login flow'
        },
        {
          id: 'idea-dark-login',
          name: 'dark login refresh',
          isCurrent: false,
          isMain: false,
          lastSavedAt: 1712636200,
          lastMessage: 'Try the darker card layout'
        }
      ]
    });
    bridge.listHistory.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'record-1',
          message: 'Stable login flow',
          timestamp: 1712636100,
          changedFiles: 2,
          files: ['src/login.tsx', 'src/auth.ts']
        }
      ]
    });
    window.tapgit = bridge as never;

    renderPlansPage('en-US');

    expect(await screen.findByText('Your Stable Version')).toBeInTheDocument();
    expect(screen.getByText('Idea Copies')).toBeInTheDocument();
    expect(screen.getByText('Each idea copy stays separate until you decide to bring it back.')).toBeInTheDocument();
    expect(screen.getAllByText('dark login refresh').length).toBeGreaterThan(0);
    expect(screen.getByText('Will be added into:')).toBeInTheDocument();
    expect(screen.getAllByText('Stable Version').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Bring It Back' })).toBeEnabled();
  });
});
