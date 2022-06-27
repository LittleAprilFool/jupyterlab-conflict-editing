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
// import { Awareness } from 'y-protocols/awareness';

import { ExecutionInject } from './executionInject';
import { CollaborationWidget } from './sideWidget';
import * as Icons from '@jupyterlab/ui-components';
import { MainAreaWidget } from '@jupyterlab/apputils';

// let NBTracker: INotebookTracker;
const executionInject = new ExecutionInject();
let thisUser = '';
const collaborationWidget = new CollaborationWidget();
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'conflict-editing:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension conflict-editing is activated!!!2333');
    app.docRegistry.addWidgetExtension('Notebook', new ForkButtonExtension());
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

        // after opening a widget, rewrite the cell execution method, and execute the magic code
        if (notebookPanel.sessionContext.session) {
          executionInject.init(notebookPanel.sessionContext.session);
        }

        // if the user restarts the kernel, execute the magic code again
        notebookPanel.sessionContext.kernelChanged.connect(
          executionInject.injectMagicCode.bind(executionInject)
        );

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
            renderCellDecoration(widget, widgets as Cell[]);
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

        console.log(thisUser);

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
      renderCellDecoration(widget, widgets);
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
    if (metaData) {
      // remove item
      const versionItem = document.querySelector(
        `#version-item-${metaData.id}`
      );
      if (versionItem) {
        versionItem.parentNode?.removeChild(versionItem);
      }
      const isSelected = versionItem?.classList.contains('selected');
      const groupItem = document.querySelector(
        `#cell-version-selection-tab-${metaData.parent}`
      );
      if (groupItem?.childNodes.length === 0) {
        // no child node, remove this
        groupItem.parentNode?.removeChild(groupItem);
      } else if (isSelected) {
        // switch select if the deleted cell is previously selected
        const firstElement = groupItem?.children[0];
        const id = firstElement?.id?.split('-').pop();
        const nextCellTab = document.querySelector(`#version-item-${id}`);
        nextCellTab?.classList.toggle('selected');
        const nextCell = document.querySelector(`.cell-version-${id}`);
        nextCell?.classList.toggle('selected');
      }
    }
  }
};

export default plugin;
