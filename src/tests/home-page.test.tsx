import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { HomePage } from '../pages/HomePage';
import { useAppStore } from '../stores/useAppStore';

describe('HomePage', () => {
  it('shows recent projects', () => {
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

    render(
      <MemoryRouter>
        <I18nProvider locale="zh-CN">
          <AppActionsContext.Provider
            value={{
              openProjectFolder: async () => undefined,
              openProjectByPath: async () => undefined,
              enableProtection: async () => undefined,
              refreshProject: async () => undefined,
              refreshConfig: async () => undefined
            }}
          >
            <HomePage />
          </AppActionsContext.Provider>
        </I18nProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('最近项目')).toBeInTheDocument();
    expect(screen.getByText('project-a')).toBeInTheDocument();
    expect(screen.getByText('project-b')).toBeInTheDocument();
  });
});
