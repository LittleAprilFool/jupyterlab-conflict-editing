/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ToolbarButton } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';

import {
  NotebookActions,
  NotebookPanel,
  INotebookModel
} from '@jupyterlab/notebook';

import { Cell } from '@jupyterlab/cells';

import { IDisposable, DisposableDelegate } from '@lumino/disposable';
import { random } from './utils';

interface IMetaDataType {
  id: string;
  parent: string;
  name: string;
  ismain: boolean;
}

export class ForkButtonExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  /**
   * Create a new extension for the notebook panel widget.
   *
   * @param panel Notebook panel
   * @param context Notebook context
   * @returns Disposable on the added button
   */
  //   private _notebookTracker: INotebookTracker;
  private _originInsertBelow: any;
  //   constructor(notebookTracker: INotebookTracker) {
  //     this._notebookTracker = notebookTracker;
  //   }
  constructor(originInsertBelow: any) {
    this._originInsertBelow = originInsertBelow;
  }
  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): IDisposable {
    const forkCell = () => {
      const notebook = panel.content;
      const activeCell = notebook.activeCell;
      if (activeCell) {
        addMetaData(activeCell);
        // renderCellDecoration(activeCell);
        const cellContent = activeCell.model.value.text;
        this._originInsertBelow(notebook);
        const newCell = notebook.activeCell;
        if (newCell) {
          addMetaData(newCell, activeCell);
          // renderCellDecoration(newCell);
          newCell.model.value.text = cellContent;
        }
      }
      NotebookActions.clearAllOutputs(panel.content);
    };
    const button = new ToolbarButton({
      className: 'fork-cell-button',
      label: 'Fork A Cell',
      onClick: forkCell,
      tooltip: 'Fork A Cell'
    });

    panel.toolbar.insertItem(10, 'forkCell', button);
    return new DisposableDelegate(() => {
      button.dispose();
    });
  }
}
const addMetaData = (cell: Cell, parent_cell?: Cell) => {
  if (!cell.model.metadata.has('conflict_editing')) {
    const id = random(4);
    let parent_id = id;
    const ismain = false;
    if (parent_cell) {
      const parent_meta = parent_cell.model.metadata.get('conflict_editing');
      if (parent_meta) {
        parent_id = (parent_meta as any as IMetaDataType).parent;
      }
    }
    const metaData: IMetaDataType = {
      id,
      parent: parent_id,
      name: id,
      ismain
    };
    cell.model.metadata.set('conflict_editing', metaData as any);
  }
};
