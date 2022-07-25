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
import { renderCellDecoration } from './cellDecoration';
import { ForkButtonExtension } from './forkButton';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { YNotebook } from '@jupyterlab/shared-models';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
// import { Awareness } from 'y-protocols/awareness';

import { ExecutionInject } from './executionInject';
import { CollaborationWidget } from './sideWidget';
import * as Icons from '@jupyterlab/ui-components';
import { MainAreaWidget } from '@jupyterlab/apputils';
import { changeCellActions } from './cellActions';

// let NBTracker: INotebookTracker;
const executionInject = new ExecutionInject();
let thisUser = '';
const renderStyle = 'fold';
const collaborationWidget = new CollaborationWidget();
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'conflict-editing:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension conflict-editing is activated!!!23456');
    // change the cell insert, copy, delete behaviors
    const { originInsertBelow } = changeCellActions();
    app.docRegistry.addWidgetExtension(
      'Notebook',
      new ForkButtonExtension(originInsertBelow)
    );
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
              onCellMetaChange(metaData, widget, widgets as Cell[], changes);
            }
          );
          // render existing versions
          const metaData = widget.model.metadata.get('conflict_editing') as any;
          // TODO: sometimes the cell decoration is not rendered when refreshing the page; no metadata is read from the model; close and reopen notebook would fix;
          if (metaData) {
            renderCellDecoration(widget, widgets as Cell[], renderStyle);
          }
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
              console.log('notebook meta change');
              const variableData = metaData.get('variable_inspec') as any[];
              collaborationWidget.updateInspectData(variableData);
              if (variableData) {
                const blockedVariables = variableData.filter(
                  x => x.access.indexOf(thisUser) >= 0
                );
                executionInject.updateBlockedVariable(blockedVariables);
                // highlight blocked variables in the code cells
                updateVariableHighlights(tracker, blockedVariables);
                console.log(blockedVariables);
              }
            }
          }
        );

        // simulate user info
        const username = document.cookie
          .split('; ')
          ?.find(row => row.startsWith('hub_user='))
          ?.split('=')[1];

        const model = notebookPanel.content.model!.sharedModel as YNotebook;
        const currentState = model.awareness.getLocalState();
        thisUser = currentState?.user.name ?? '';
        if (username) {
          model.awareness.setLocalStateField('user', { name: username });
          thisUser = username;
        }

        // collect current users
        model.awareness.on('change', () => {
          const strings: string[] = [];
          model.awareness.getStates().forEach(state => {
            if (state.user) {
              strings.push(state.user.name);
            }
          });
          collaborationWidget.updateUserList(strings);
        });
      }
    );

    tracker.activeCellChanged.connect((_, cell: Cell | null) => {
      if (cell) {
        collaborationWidget.updateCellSelection(cell);
      }
    });
  }
};

const updateVariableHighlights = (
  tracker: INotebookTracker,
  variables: any[]
) => {
  variables.forEach(variable => {
    const widgets = tracker.currentWidget?.content?.widgets;
    widgets?.forEach(widget => {
      if (widget.editor instanceof CodeMirrorEditor) {
        const cm = widget.editor.editor;
        const cursor = cm.getSearchCursor(
          new RegExp(`\\b${variable.varName}\\b`)
        );
        while (cursor.findNext()) {
          cm.markText(cursor.from(), cursor.to(), {
            className: 'restricted-variable-highlights'
          });
        }
      }
    });
  });
};

const onCellMetaChange = (
  cmetaData: IObservableJSON,
  widget: Cell,
  widgets: Cell[],
  changes: any
) => {
  console.log('cell meta change');
  if (changes.key === 'conflict_editing') {
    console.log('cell meta changed!!', cmetaData, changes);
    const conflictData = cmetaData.get('conflict_editing') as any;
    if (conflictData) {
      renderCellDecoration(widget, widgets, renderStyle);
    }
  }
  if (changes.key === 'access_control') {
    console.log('cell meta changed!!', cmetaData, changes);
    const accessData = changes.newValue;
    collaborationWidget.updateAccessData(accessData);
    if (accessData) {
      if (accessData.edit.includes(thisUser)) {
        widget.editor.setOption('readOnly', true);
        widget.addClass('colab-edit-lock');
      } else {
        widget.editor.setOption('readOnly', false);
        widget.removeClass('colab-edit-lock');
      }
      if (accessData.read.includes(thisUser)) {
        widget.addClass('colab-read-lock');
      } else {
        widget.removeClass('colab-read-lock');
      }
    }
  }
};

const onCellsChange = (
  tracker: INotebookTracker,
  _cells?: IObservableUndoableList<ICellModel>,
  changes?: IObservableList.IChangedArgs<ICellModel>
) => {
  console.log('on cells change');
  if (changes?.type === 'add') {
    const widgets = tracker.currentWidget?.content.widgets;
    if (widgets && widgets.length > 0) {
      const widget = widgets[changes.newIndex];
      widget.model.metadata.changed.connect(
        (metaData: IObservableJSON, changes) => {
          onCellMetaChange(metaData, widget, widgets as Cell[], changes);
        }
      );
    }
  }
  if (changes?.type === 'remove') {
    const metaData = changes.oldValues[0]?.metadata.get(
      'conflict_editing'
    ) as any;
    //TODO: The deletion is not working well now
    if (metaData) {
      // // remove item
      // const versionItem = document.querySelector(
      //   `#version-item-${metaData.id}`
      // );
      // if (versionItem) {
      //   versionItem.parentNode?.removeChild(versionItem);
      // }
      // const isSelected = versionItem?.classList.contains('selected');
      // const groupItem = document.querySelector(
      //   `#cell-version-selection-tab-${metaData.parent}`
      // );
      const siblingCells = document.querySelectorAll(
        `.cell-version-parallel-${metaData.id}`
      );

      const siblingTabs = document.querySelectorAll(
        `.cell-version-selection-tab-parent-${metaData.parent}`
      );

      // if this is the last cell in the group
      if (siblingCells.length === 0 && siblingTabs.length > 0) {
        console.log('only one!!');
        // step one: make the next selected cell group available
        const siblingParent = siblingTabs[0].parentNode as HTMLDivElement;
        const classlists = [...siblingParent.classList];
        const targetClass = classlists.filter(
          str =>
            str.includes('cell-version-parallel') && !str.includes('parent')
        );
        if (targetClass.length > 0) {
          const nextID = targetClass[0].split('-').pop();
          const hiddenCells = document.querySelectorAll(
            `.cell-version-parallel-${nextID}`
          );
          hiddenCells.forEach(cell => {
            (cell as HTMLDivElement).style.display = 'block';
          });
          console.log(nextID);
        }

        // step two: remove all the tabs
        const tabElements = document.querySelectorAll(
          `#version-item-${metaData.id}`
        );
        console.log(tabElements);
        tabElements.forEach(ele => {
          ele.parentNode?.removeChild(ele);
        });

        // const nextID = siblingTabs[0].classList
        // siblingTabs[0].parentNode.style.display = 'block';
      }
      // if (groupItem?.childNodes.length === 0) {
      //   // no child node, remove this
      //   groupItem.parentNode?.removeChild(groupItem);
      // } else
      // if (isSelected) {
      //   // switch select if the deleted cell is previously selected
      //   const firstElement = groupItem?.children[0];
      //   const id = firstElement?.id?.split('-').pop();
      //   const nextCellTab = document.querySelector(`#version-item-${id}`);
      //   nextCellTab?.classList.toggle('selected');
      //   const nextCell = document.querySelector(`.cell-version-${id}`);
      //   nextCell?.classList.toggle('selected');
      // }
    }
  }
};

export default plugin;
