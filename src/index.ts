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
import { Awareness } from 'y-protocols/awareness';

import { ExecutionInject } from './executionInject';

let NBTracker: INotebookTracker;
const executionInject = new ExecutionInject();

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'conflic-editing:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension conflic-editing is activated!!!');
    app.docRegistry.addWidgetExtension('Notebook', new ForkButtonExtension());
    const fontAwesome = document.createElement('script');
    fontAwesome.src = 'https://kit.fontawesome.com/00f360a06b.js';
    document.head.appendChild(fontAwesome);
    let currentCell: Cell | null = null;
    NBTracker = tracker;
    tracker.activeCellChanged.connect((_, cell: Cell | null) => {
      currentCell = cell;
    });

    executionInject.init(tracker.currentWidget?.sessionContext.session as any);

    // detect kernel information
    // inject magic cell command
    tracker.currentChanged.connect(onWidgetChange);
    tracker.currentWidget?.sessionContext.kernelChanged.connect(
      executionInject.injectMagicCode.bind(executionInject)
    );

    let lastAwareness: Awareness | null = null;
    tracker.currentChanged.connect((_, notebook: NotebookPanel | null) => {
      if (notebook === null) {
        lastAwareness = null;
        return;
      }

      // Clean up old awareness handler
      if (lastAwareness !== null) {
        lastAwareness.off('change', awarenessHandler);
      }

      // Add new awareness handler
      const model = notebook.model!.sharedModel as YNotebook;
      lastAwareness = model.awareness;
      model.awareness.on('change', awarenessHandler);
    });
    const awarenessHandler = (awareness: any): void => {
      // if this cell is a private cell, add awareness info
      if (currentCell && currentCell.model.metadata.has('conflict_editing')) {
        // console.log('add awareness to the cell');
        // console.log(currentCell.model);
        // console.log(lastAwareness?.getLocalState());
        // const metaData = currentCell.model.metadata.get(
        //   'conflict_editing'
        // ) as any;
        // const versionItem = document.querySelector(
        //   `#version-item-${metaData.id}`
        // );
        // if (!versionItem) {
        //   renderCellDecoration(currentCell);
        // }
      }
    };
  }
};

const onWidgetChange = (tracker: INotebookTracker) => {
  console.log('onWidgetChange');
  tracker.currentWidget?.sessionContext.kernelChanged.connect(
    executionInject.injectMagicCode.bind(executionInject)
  );
  tracker.currentWidget?.content?.model?.cells.changed.connect(onCellsChange);
  tracker.currentWidget?.sessionContext.ready.then(() => {
    // after the notebook is loaded
    console.log('session ready');
    const widgets = tracker.currentWidget?.content?.widgets;
    widgets?.forEach(widget => {
      // attach meta change callback to code cell
      widget.model.metadata.changed.connect((metaData: IObservableJSON) => {
        onCellMetaChange(metaData, widget);
      });
      // render existing versions
      const metaData = widget.model.metadata.get('conflict_editing') as any;
      if (metaData) {
        renderCellDecoration(widget, widgets as Cell[]);
      }
    });
  });
};

const onCellMetaChange = (cmetaData: IObservableJSON, widget: Cell) => {
  console.log('change cell meta');
  const metaData = cmetaData.get('conflict_editing') as any;
  if (metaData) {
    renderCellDecoration(
      widget,
      NBTracker.currentWidget?.content?.widgets as Cell[]
    );
  }
};

const onCellsChange = (
  cells?: IObservableUndoableList<ICellModel>,
  changes?: IObservableList.IChangedArgs<ICellModel>
) => {
  console.log('on cells change');
  if (changes?.type === 'add') {
    const widgets = NBTracker.currentWidget?.content.widgets;
    if (widgets && widgets.length > 0) {
      const widget = widgets[changes.newIndex];
      widget.model.metadata.changed.connect((metaData: IObservableJSON) => {
        onCellMetaChange(metaData, widget);
      });
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
