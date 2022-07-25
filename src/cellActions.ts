import { Notebook, NotebookActions } from '@jupyterlab/notebook';

export const changeCellActions = (): any => {
  console.log('change cell actions');
  return { originInsertBelow: changeInsertBelow() };
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

//TODO: add support for changing cell type
//!carefully test other cell manipulations
