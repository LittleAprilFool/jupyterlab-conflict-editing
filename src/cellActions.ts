import { Notebook, NotebookActions } from '@jupyterlab/notebook';
import { renderCellDecoration } from './cellDecoration';
export const changeCellActions = (): any => {
  console.log('change cell actions');
  return {
    originInsertBelow: changeInsertBelow(),
    originInsertAbove: changeInsertAbove(),
    originChangeCellType: changeCellType(),
    originMoveDown: changeMoveDown(),
    originMoveUp: changeMoveUp()
  };
};

const changeInsertBelow = () => {
  const insertBelowFn = NotebookActions.insertBelow;
  NotebookActions.insertBelow = (notebook: Notebook): void => {
    const cell = notebook.activeCell;
    const conflictData = cell?.model.metadata.get('conflict_editing');
    insertBelowFn(notebook);
    const newCell = notebook.activeCell;
    if (conflictData) {
      newCell?.model.metadata.set('conflict_editing', conflictData);
    }
  };
  return insertBelowFn;
};
const changeInsertAbove = () => {
  const insertAboveFn = NotebookActions.insertAbove;
  NotebookActions.insertAbove = (notebook: Notebook): void => {
    const cell = notebook.activeCell;
    const conflictData = cell?.model.metadata.get('conflict_editing');
    insertAboveFn(notebook);
    const newCell = notebook.activeCell;
    if (conflictData) {
      newCell?.model.metadata.set('conflict_editing', conflictData);
    }
  };
  return insertAboveFn;
};
const changeCellType = () => {
  const changeCellTypeFn = NotebookActions.changeCellType;
  NotebookActions.changeCellType = (notebook: Notebook, value: any): void => {
    const cell = notebook.activeCell;
    const conflictData = cell?.model.metadata.get('conflict_editing');
    changeCellTypeFn(notebook, value);
    const newCell = notebook.activeCell;
    if (conflictData && newCell && notebook.model?.cells) {
      newCell.model.metadata.set('conflict_editing', conflictData);
      renderCellDecoration(newCell, notebook.model?.cells as any);
      //TODO: on collaborator's side, the markdown cell is rendered and doesn't come with decorations
    }
  };
  return changeCellTypeFn;
};

const changeMoveDown = () => {
  const moveDownFn = NotebookActions.moveDown;
  NotebookActions.moveDown = (notebook: Notebook): void => {
    const cell = notebook.activeCell;
    const conflictData = cell?.model.metadata.get('conflict_editing');
    if (conflictData) {
      console.log('disable move down');
      alert('can not operate this');
    } else {
      moveDownFn(notebook);
    }
  };
  return moveDownFn;
};

const changeMoveUp = () => {
  const moveUpFn = NotebookActions.moveUp;
  NotebookActions.moveUp = (notebook: Notebook): void => {
    const cell = notebook.activeCell;
    const conflictData = cell?.model.metadata.get('conflict_editing');
    if (conflictData) {
      console.log('disable move down');
      alert('can not operate this');
    } else {
      moveUpFn(notebook);
    }
  };
  return moveUpFn;
};
//TODO: add support for changing cell type
//!carefully test other cell manipulations

//TODO: disable cell moving for parallel cells
