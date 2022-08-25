import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import {
  IObservableList,
  IObservableUndoableList,
  IObservableJSON
} from '@jupyterlab/observables';
import {
  renderUnindent,
  renderCellDecoration,
  renderParallelIndentationButton
} from './parallelGroupView';
// import { ForkButtonExtension } from './forkButton';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { YNotebook } from '@jupyterlab/shared-models';
// import { Awareness } from 'y-protocols/awareness';

import { ExecutionInject } from './executionInject';
import { CollaborationWidget } from './sideWidget';
import * as Icons from '@jupyterlab/ui-components';
import { MainAreaWidget } from '@jupyterlab/apputils';
import { changeCellActions } from './cellActions';
import { syncCellDeletion, updateVariableHighlights } from './viewSync';
import { renderCellAccessOverview } from './cellAccessView';

// let NBTracker: INotebookTracker;
const executionInject = new ExecutionInject();
let thisUser = '';
let userList: any[] = [];
const collaborationWidget = new CollaborationWidget();
export const { originInsertBelow, originInsertAbove } = changeCellActions();
export const getUserList = (): any[] => {
  return userList;
};

export const getThisUser = (): string => {
  return thisUser;
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'conflict-editing:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension conflict-editing is activated!!!23456');
    // // change the cell insert, copy, delete behaviors
    // app.docRegistry.addWidgetExtension(
    //   'Notebook',
    //   new ForkButtonExtension(originInsertBelow)
    // );
    const fontAwesome = document.createElement('script');
    fontAwesome.src = 'https://kit.fontawesome.com/00f360a06b.js';
    document.head.appendChild(fontAwesome);
    // add side widget
    const widget = new MainAreaWidget<CollaborationWidget>({
      content: collaborationWidget
    });
    widget.title.closable = true;
    widget.title.icon = Icons.jupyterFaviconIcon;
    app.shell.add(widget, 'right');

    tracker.widgetAdded.connect(
      async (_sender: INotebookTracker, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await notebookPanel.sessionContext.ready;
        await tracker.currentWidget?.revealed;

        // after opening a widget, rewrite the cell execution method, and execute the magic code
        if (notebookPanel.sessionContext.session) {
          executionInject.init(notebookPanel.sessionContext.session);
        }

        // if the user restarts the kernel, execute the magic code again
        notebookPanel.sessionContext.kernelChanged.connect((output: any) => {
          executionInject.injectMagicCode(output);
          collaborationWidget.updateNotebook(notebookPanel);
          notebookPanel.model?.metadata.set('variable_inspec', []);
        });

        // render cell decoration
        const widgets = tracker.currentWidget?.content?.widgets;
        widgets?.forEach(widget => {
          // attach meta change callback to code cell
          widget.model.metadata.changed.connect(
            (metaData: IObservableJSON, changes?: any) => {
              onCellMetaChange(
                metaData,
                widget,
                widgets as Cell[],
                changes,
                tracker
              );
            }
          );
          // render existing versions
          const metaData = widget.model.metadata.get('conflict_editing') as any;
          // TODO: sometimes the cell decoration is not rendered when refreshing the page; no metadata is read from the model; close and reopen notebook would fix;
          if (metaData) {
            renderCellDecoration(widget, widgets as Cell[], tracker);
          }

          renderCellAccessOverview(widget);
        });

        // listen to cell changes
        tracker.currentWidget?.content?.model?.cells.changed.connect(
          (
            _cells?: IObservableUndoableList<ICellModel>,
            changes?: IObservableList.IChangedArgs<ICellModel>
          ) => {
            onCellsChange(tracker, _cells, changes);
          }
        );

        // listen to notebook meta changes
        tracker.currentWidget?.content?.model?.metadata.changed.connect(
          (metaData: IObservableJSON, changes?: any) => {
            if (changes.key === 'variable_inspec') {
              const variableData = metaData.get('variable_inspec') as any[];
              collaborationWidget.updateInspectData(variableData);
              if (variableData) {
                const blockedVariables = variableData.filter(
                  x => x.access.indexOf(thisUser) >= 0
                );
                executionInject.updateBlockedVariable(blockedVariables);
                // highlight blocked variables in the code cells
                updateVariableHighlights(tracker, blockedVariables);
              }
            }
            if (changes.key === 'chat') {
              const chatData = metaData.get('chat') as any[];
              collaborationWidget.updateChatData(chatData);
            }
          }
        );

        // simulate user info
        const username = document.cookie
          .split('; ')
          ?.find(row => row.startsWith('hub_user='))
          ?.split('=')[1];
        const isCreator =
          window.location.pathname.split('/')[1] === 'lab' ||
          window.location.pathname.split('/')[2] === username;
        const color = Math.floor(Math.random() * 16777215).toString(16);

        const model = notebookPanel.content.model!.sharedModel as YNotebook;
        const currentState = model.awareness.getLocalState();
        thisUser = currentState?.user.name ?? '';
        if (username) {
          model.awareness.setLocalStateField('user', {
            name: username,
            color: `#${color}`,
            isCreator
          });
          thisUser = username;
        }

        // collect current users
        model.awareness.on('change', () => {
          const users: any[] = [];
          model.awareness.getStates().forEach(state => {
            if (state.user) {
              users.push(state.user);
            }
          });
          userList = users;
          collaborationWidget.updateUserList(users);
        });
      }
    );

    tracker.activeCellChanged.connect((_, cell: Cell | null) => {
      if (cell) {
        collaborationWidget.updateCellSelection(cell);
        renderParallelIndentationButton(cell, tracker);
      }
    });
  }
};

const onCellMetaChange = (
  cmetaData: IObservableJSON,
  widget: Cell,
  widgets: Cell[],
  changes: any,
  tracker: INotebookTracker
): void => {
  console.log('cell meta change');
  if (changes.key === 'conflict_editing') {
    console.log('cell meta changed!!', cmetaData, changes);
    const conflictData = cmetaData.get('conflict_editing') as any;
    if (conflictData) {
      renderCellDecoration(widget, widgets, tracker);
    } else {
      //remove cell decoration
      if (changes.type === 'change') {
        console.log('render unindent');
        renderUnindent(widget, changes.oldValue);
        widget.model.metadata.delete('conflict_editing');
        renderCellAccessOverview(widget);
      }
    }
  }
  if (changes.key === 'access_control') {
    console.log('cell meta changed!!', cmetaData, changes);
    const accessData = changes.newValue;
    if (accessData) {
      if (accessData.edit && accessData.edit.includes(thisUser)) {
        widget.editor.setOption('readOnly', true);
        widget.addClass('colab-edit-lock');
      } else {
        widget.editor.setOption('readOnly', false);
        widget.removeClass('colab-edit-lock');
      }
      if (accessData.read && accessData.read.includes(thisUser)) {
        widget.addClass('colab-read-lock');
      } else {
        widget.removeClass('colab-read-lock');
      }
    }
    renderCellAccessOverview(widget);
  }
};

const onCellsChange = (
  tracker: INotebookTracker,
  _cells?: IObservableUndoableList<ICellModel>,
  changes?: IObservableList.IChangedArgs<ICellModel>
): void => {
  console.log('on cells change', changes);
  if (changes?.type === 'add') {
    const widgets = tracker.currentWidget?.content.widgets;
    if (widgets && widgets.length > 0) {
      const widget = widgets[changes.newIndex];
      widget.model.metadata.changed.connect(
        (metaData: IObservableJSON, changes) => {
          onCellMetaChange(
            metaData,
            widget,
            widgets as Cell[],
            changes,
            tracker
          );
        }
      );
      renderCellAccessOverview(widget);
    }
  }
  if (changes?.type === 'remove') {
    const metaData = changes.oldValues[0]?.metadata.get(
      'conflict_editing'
    ) as any;
    if (metaData) {
      syncCellDeletion(metaData, tracker);
    }
  }
};

export default plugin;
