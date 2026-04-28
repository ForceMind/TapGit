import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { SettingsPage } from '../pages/SettingsPage';
import { useAppStore } from '../stores/useAppStore';

const defaultActions = {
  openProjectFolder: async () => undefined,
  openCloneProjectDialog: async () => undefined,
  openProjectByPath: async () => undefined,
  enableProtection: async () => undefined,
  refreshProject: async () => undefined,
  refreshConfig: async () => undefined,
  showProjectInFolder: async () => undefined,
  saveAllProgress: async () => undefined,
  uploadCloud: async () => undefined,
  getLatestFromCloud: async () => undefined,
  openIdeaCopyDialog: () => undefined
};

function createBridgeMock() {
  return {
    chooseProjectFolder: vi.fn(),
    chooseCloneDestination: vi.fn(),
    openProject: vi.fn(),
    getProjectOverview: vi.fn(),
    cloneProjectFromGitHub: vi.fn(),
    openInFileManager: vi.fn(),
    enableProtection: vi.fn(),
    getCurrentChanges: vi.fn(),
    stopTrackingFile: vi.fn(),
    discardAllChanges: vi.fn(),
    saveProgress: vi.fn(),
    listHistory: vi.fn(),
    listSafetyBackups: vi.fn(),
    createSafetyBackup: vi.fn(),
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

function renderSettingsPage(locale: 'en-US' | 'zh-CN') {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={defaultActions}>
          <SettingsPage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
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

  it('shows the redesigned settings sections and keeps sync tools available', async () => {
    const bridge = createBridgeMock();
    bridge.checkGitEnvironment.mockResolvedValue({
      ok: true,
      data: {
        available: true,
        version: '2.48.1'
      }
    });
    bridge.getCloudSyncStatus.mockResolvedValue({
      ok: true,
      data: {
        connected: true,
        remoteLabel: 'origin',
        remoteUrl: 'https://github.com/force-mind/project-a.git',
        currentPlan: 'main',
        hasTracking: true,
        pendingUpload: 2,
        pendingDownload: 1,
        statusText: 'local changes waiting'
      }
    });
    bridge.getGitHubAuthStatus.mockResolvedValue({
      ok: true,
      data: {
        available: true,
        accounts: ['force-mind'],
        activeAccount: 'force-mind'
      }
    });
    window.tapgit = bridge as never;

    renderSettingsPage('en-US');

    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save Settings' })).toBeInTheDocument();
    expect(screen.getByText('Default save behavior')).toBeInTheDocument();
    expect(screen.getByText('Save confirmation')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('force-mind')).toBeInTheDocument();
    expect(screen.getByText('force-mind <tapgit@local.dev>')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    expect(await screen.findByText('Sync Workflow')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account, project, then save points' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Project Address' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Sync Save Points' })).toBeInTheDocument();
    expect(screen.getByText('https://github.com/force-mind/project-a.git')).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.checkGitEnvironment).toHaveBeenCalledTimes(1);
      expect(bridge.getCloudSyncStatus).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.getGitHubAuthStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('explains browser-based GitHub sign-in instead of showing a false success', async () => {
    const bridge = createBridgeMock();
    bridge.checkGitEnvironment.mockResolvedValue({
      ok: true,
      data: {
        available: true,
        version: '2.48.1'
      }
    });
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
        statusText: 'not connected'
      }
    });
    bridge.getGitHubAuthStatus.mockResolvedValue({
      ok: true,
      data: {
        available: false,
        accounts: [],
        activeAccount: null
      }
    });
    bridge.loginGitHub.mockResolvedValue({
      ok: true,
      data: {
        available: false,
        accounts: [],
        activeAccount: null,
        browserLoginOpened: true,
        helpUrl: 'https://github.com/login'
      }
    });
    window.tapgit = bridge as never;

    renderSettingsPage('en-US');
    fireEvent.click(await screen.findByRole('button', { name: 'Sync' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign In to GitHub' }));

    await waitFor(() => {
      expect(bridge.loginGitHub).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().notice).toEqual({
        type: 'info',
        text: 'GitHub sign-in page opened. Finish sign-in in the browser, then return to TapGit and refresh or sign in again.'
      });
    });
  });
});
