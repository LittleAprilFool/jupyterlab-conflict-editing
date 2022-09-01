import { Cell } from '@jupyterlab/cells';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { addMetaData, IMetaDataType, onForkHandler } from './forkButton';
import { logger, originInsertAbove } from '.';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { EventType } from './logger';
// unfold; fold; side-by-side

export const renderCellDecoration = (
  cell: Cell,
  cells: Cell[],
  tracker?: INotebookTracker
): void => {
  // if this cell is not rendered
  if (
    cell.model.metadata.has('conflict_editing') &&
    !cell.hasClass('cell-version')
  ) {
    const staledAccess = cell.node.querySelector('.cellaccess-overview');
    staledAccess?.parentNode?.removeChild(staledAccess);
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    // if this cell group is not the first element in the group
    const notFirstCell =
      document.querySelector(`.cell-version-parallel-${metaData.id}`) !== null;

    cell.addClass('cell-version');
    cell.addClass(`cell-version-parallel-${metaData.id}`);
    cell.addClass(`cell-version-parallel-parent-${metaData.parent}`);

    // if this cell group is not the first element in the group, we don't need to render the tabs
    if (notFirstCell) {
      // we decide to hide the cell or not depending on whether the group is selected
      const siblingTabs = document.querySelectorAll(
        `.cell-version-selection-tab-parent-${metaData.parent}`
      );
      siblingTabs.forEach(sibling => {
        const siblingTab = sibling as HTMLDivElement;
        const parentNode = siblingTab.parentNode as HTMLDivElement;
        if (parentNode.style.display !== 'none') {
          // find the selected tab
          const selectedTab = siblingTab.querySelector('.selected');
          if (selectedTab?.id !== `version-item-${metaData.id}`) {
            cell.node.style.display = 'none';
          }
        }
      });
      return;
    }

    // if this cell group is the first element in the group, we need to create selectionTabs
    let selectionTab = document.createElement('div') as any;

    // check if there is a parent selection tab created for other groups in the same family
    const parentSelectionTab = document.querySelector(
      `.cell-version-selection-tab-parent-${metaData.parent}`
    );

    // if so, we need to clone the node
    if (parentSelectionTab) {
      cell.node.style.display = 'none';
      selectionTab = parentSelectionTab.cloneNode(true);
      selectionTab.id = `cell-version-selection-tab-${metaData.id}`;
      for (let i = 0; i < selectionTab.childNodes.length; i++) {
        const mirrorNode = parentSelectionTab.childNodes[i] as HTMLDivElement;
        selectionTab.childNodes[i].onclick = mirrorNode.onclick;
      }
      const selectionTab_sync = selectionTab.querySelector(
        '.sync-btn'
      ) as HTMLDivElement;
      const mirrorNode_sync = parentSelectionTab.querySelector(
        '.sync-btn'
      ) as HTMLDivElement;
      if (mirrorNode_sync) {
        selectionTab_sync.onclick = mirrorNode_sync.onclick;
      }

      const selectionTab_fork = selectionTab.querySelector(
        '.version-fork'
      ) as HTMLDivElement;
      const mirrorNode_fork = parentSelectionTab.querySelector(
        '.version-fork'
      ) as HTMLDivElement;
      if (mirrorNode_fork) {
        selectionTab_fork.onclick = mirrorNode_fork.onclick;
      }

      const currentTab = createCurrentTab(metaData, cell, cells, selectionTab);
      const currentTabNonSelected = currentTab.cloneNode(
        true
      ) as HTMLDivElement;
      currentTabNonSelected.onclick = currentTab.onclick;
      currentTab.classList.add('selected');
      selectionTab.childNodes.forEach((ele: any): void => {
        ele.classList.remove('selected');
      });
      selectionTab.appendChild(currentTab);
      // parentSelectionTab.appendChild(currentTabNonSelected);
      const siblingTabs = document.querySelectorAll(
        `.cell-version-selection-tab-parent-${metaData.parent}`
      );
      siblingTabs.forEach((ele: any): void => {
        const newTab = currentTabNonSelected.cloneNode(true) as HTMLDivElement;
        newTab.onclick = currentTabNonSelected.onclick;
        ele.appendChild(newTab);
      });

      // check if this is the primary group
      if (metaData.ismain) {
        const otherCells = document.querySelectorAll(
          `.cell-version-parallel-parent-${metaData.parent}`
        );
        otherCells.forEach(cell => {
          if (
            !cell.className.includes(`.cell-version-parallel-${metaData.id}`)
          ) {
            (cell as HTMLDivElement).style.display = 'none';
          }
        });
        cell.node.style.display = 'block';
      }
    } else {
      // if this is the first selection tab
      // create a new tab
      selectionTab.id = `cell-version-selection-tab-${metaData.id}`;
      selectionTab.classList.add('cell-version-selection-tab-container');
      selectionTab.classList.add(
        `cell-version-selection-tab-parent-${metaData.parent}`
      );
      const rightBtnGroup = document.createElement('div');
      rightBtnGroup.classList.add('right-btn');
      const forkButton = document.createElement('div');
      forkButton.classList.add('right-btn-item');
      forkButton.classList.add('version-fork');
      forkButton.id = `version-fork-${metaData.parent}`;
      const syncButton = document.createElement('div');
      syncButton.classList.add('right-btn-item');
      syncButton.classList.add('sync-btn');
      syncButton.id = `sync-btn-${metaData.parent}`;
      rightBtnGroup.appendChild(syncButton);
      rightBtnGroup.appendChild(forkButton);
      selectionTab.appendChild(rightBtnGroup);
      forkButton.onclick = e => {
        const parent_id = (e.target as HTMLElement).id.split('-')[2];
        if (tracker) {
          logger.send(EventType.ForkParallelCell);
          onForkHandler(parent_id, tracker, cell.model.value.text);
        }
      };
      syncButton.onclick = e => {
        if (tracker) {
          logger.send(EventType.SyncParallelKernel);
          const current_cell = tracker.activeCell as any;
          const meta = current_cell?.model.metadata.get(
            'conflict_editing'
          ) as any;
          if (meta && meta.name) {
            syncKernel(tracker, meta.name);
            cells.forEach(c => {
              const thisc = c as any;
              const cmeta = c.model.metadata.get('conflict_editing') as any;
              if (cmeta && cmeta.id === meta.id) {
                thisc.model.clearExecution();
              }
            });
          }
        }
      };
      const currentTab = createCurrentTab(metaData, cell, cells, selectionTab);
      currentTab.classList.add('selected');
      selectionTab?.appendChild(currentTab);
    }
    cell.node?.insertBefore(selectionTab, cell.node.firstChild);
  }

  if (
    cell.model.metadata.has('conflict_editing') &&
    cell.hasClass('cell-version')
  ) {
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    const tabComponents = document.querySelectorAll(
      `#version-item-${metaData.id}`
    );
    tabComponents.forEach(tabComponent => {
      const tabNameEle = tabComponent?.children[1];
      if (tabNameEle && tabNameEle.textContent !== metaData.name) {
        tabNameEle.textContent = metaData.name;
      }
      const mainMark = tabComponent?.querySelector('.mainmark');
      const isContain = mainMark?.classList.contains('ismain');
      if (isContain !== metaData.ismain) {
        mainMark?.classList.toggle('ismain');
      }
    });
  }
};

export const createCurrentTab = (
  metaData: any,
  cell: Cell,
  cells: Cell[],
  selectionTab: HTMLDivElement
): HTMLDivElement => {
  const currentTab = document.createElement('div');
  currentTab.classList.add('cell-version-selection-tab-item');
  currentTab.id = `version-item-${metaData.id}`;
  const versionInfoLabel = document.createElement('div');
  const versionInfoEditor = document.createElement('div');
  const versionInfoEditorInput = document.createElement('input');
  const versionInfoEditorButton = document.createElement('button');
  versionInfoEditor.classList.add('hide');
  versionInfoEditorButton.innerText = 'Save';
  versionInfoLabel.innerText = metaData.name;
  versionInfoEditorInput.value = metaData.name;
  versionInfoEditor.appendChild(versionInfoEditorInput);
  versionInfoEditor.appendChild(versionInfoEditorButton);
  const mainMark = document.createElement('div');
  mainMark.className = 'mainmark';
  if (metaData.ismain) {
    mainMark.classList.add('ismain');
  }
  currentTab.appendChild(mainMark);
  currentTab.appendChild(versionInfoEditor);
  currentTab.appendChild(versionInfoLabel);
  // TODO: can't edit version info
  versionInfoLabel.ondblclick = () => {
    versionInfoLabel.classList.toggle('hide');
    versionInfoEditor.classList.toggle('hide');
  };

  mainMark.onclick = () => {
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    const newMeta = { ...metaData };
    if (!mainMark.classList.contains('ismain')) {
      const currentMain = selectionTab?.querySelector('.ismain');

      // change the metadata of the old main
      const oldMainID = currentMain?.parentElement?.id.slice(-4);
      cells.forEach(cell => {
        const cmeta = cell.model.metadata.get('conflict_editing') as any;
        if (cmeta && cmeta.id === oldMainID) {
          const ncmeta = { ...cmeta };
          ncmeta.ismain = false;
          cell.model.metadata.set('conflict_editing', ncmeta as any);
        }
      });
      // change the metadata of the new main
      newMeta.ismain = true;
    } else {
      newMeta.ismain = false;
    }
    cells.forEach(cell => {
      const cmeta = cell.model.metadata.get('conflict_editing') as any;
      if (cmeta && cmeta.id === metaData.id) {
        // change all the cells in the group, instead of the first one
        cell.model.metadata.set('conflict_editing', newMeta as any);
      }
    });
  };

  versionInfoEditorButton.onclick = () => {
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    const name = versionInfoEditorInput.value;
    const newMeta = { ...metaData };
    newMeta.name = name;
    cell.model.metadata.set('conflict_editing', newMeta as any);
    versionInfoLabel.innerText = name;
    versionInfoLabel.classList.toggle('hide');
    versionInfoEditor.classList.toggle('hide');
  };

  currentTab.onclick = (e: any) => {
    const group_id = e.target.parentNode.id.split('-')[2];
    let parent_id = '';
    e.target.parentNode.parentNode.classList.forEach((name: string) => {
      if (name.includes('parent')) {
        parent_id = name.split('-')[5];
      }
    });
    const siblingCells = document.querySelectorAll(
      `.cell-version-parallel-parent-${parent_id}`
    );
    siblingCells.forEach((ele: any): void => {
      ele.style.display = 'none';
    });
    const targetCells = document.querySelectorAll(
      `.cell-version-parallel-${group_id}`
    );
    targetCells.forEach(targetCell => {
      const targetCellModel = targetCell as HTMLDivElement;
      targetCellModel.style.display = 'block';
    });
  };
  return currentTab;
};

export const renderParallelIndentationButton = (
  cell: Cell,
  tracker: INotebookTracker
): void => {
  // clean all the indentation button first
  const staledButtons = document.querySelectorAll('.indentation-btn');
  staledButtons?.forEach(button => {
    button.parentNode?.removeChild(button);
  });

  // insert new indentation button into the cell
  const indentationNode = document.createElement('div');
  indentationNode.classList.add('indentation-btn');
  const metadata = cell.model.metadata.get('conflict_editing');
  // check if this cell is a normal cell or belong to a parallel group
  if (!metadata) {
    // if this is a normal cell, add an indentation button
    cell.node.appendChild(indentationNode);
    indentationNode.classList.add('indentation-do-btn');
    indentationNode.addEventListener('click', () => {
      logger.send(EventType.IndentCell);
      addMetaData(cell);
      indentationNode.parentNode?.removeChild(indentationNode);
    });
  } else {
    const id = (metadata as any as IMetaDataType).id;
    const group_id = (metadata as any as IMetaDataType).parent;
    // add the indentation button into the first cell in the group
    const firstCell = cell.node.parentNode?.querySelector(
      `.cell-version-parallel-${id}`
    );

    if (firstCell) {
      firstCell.appendChild(indentationNode);
    }
    indentationNode.classList.add('indentation-cancel-btn');
    indentationNode.addEventListener('click', () => {
      // this will unindent the parallel cell group
      // show a dialog for users to confirm
      logger.send(EventType.UnindentCell);
      const tabEle = cell.node.querySelectorAll(
        '.cell-version-selection-tab-item'
      );
      if (tabEle.length > 1) {
        showDialog({
          title: 'Delete Other Parallel Cell Groups',
          body: 'Unindent the current parallel cell group would delete other alternative cell groups. Do you want to continue?',
          buttons: [
            Dialog.cancelButton(),
            Dialog.okButton({
              label: 'GO',
              className: 'TDB-Prompt-Dialog__btn'
            })
          ]
        }).then(res => {
          if (res.button.label === 'GO') {
            unindentParallelGroup(id, group_id, tracker);
            indentationNode.parentNode?.removeChild(indentationNode);
          }
        });
      } else {
        unindentParallelGroup(id, group_id, tracker);
        indentationNode.parentNode?.removeChild(indentationNode);
      }
    });
  }
};

const unindentParallelGroup = (
  tid: string,
  gid: string,
  tracker: INotebookTracker
): void => {
  if (tracker.currentWidget?.content?.widgets) {
    const widgets = tracker.currentWidget?.content?.widgets as Cell[];
    const notebook = tracker.currentWidget.content;
    const unindentedCellValues: any[] = [];
    const deletedCells: Cell[] = [];
    widgets?.forEach(cell => {
      if (cell.model.metadata.has('conflict_editing')) {
        const metadata = cell.model.metadata.get('conflict_editing');
        const id = (metadata as any as IMetaDataType).id;
        const group = (metadata as any as IMetaDataType).parent;
        if (id === tid) {
          unindentedCellValues.push(cell.model.value);
        }
        if (group === gid) {
          deletedCells.push(cell);
        }
      }
    });

    notebook.deselectAll();
    deletedCells.forEach(cell => {
      notebook.select(cell);
    });

    NotebookActions.deleteCells(notebook);
    unindentedCellValues.forEach((item, index) => {
      originInsertAbove(notebook);
      const activeCell = notebook.activeCell;
      if (activeCell) {
        activeCell.model.value.text =
          unindentedCellValues[unindentedCellValues.length - index - 1].text;
      }
    });
  }
};

export const renderUnindent = (widget: Cell, meta: IMetaDataType): void => {
  // check if this group belongs to a family
  const thisTab = document.querySelector(
    `#cell-version-selection-tab-${meta.id}`
  );
  const siblingTabs = document.querySelectorAll(
    `.cell-version-selection-tab-parent-${meta.parent}`
  );

  if (siblingTabs.length > 1) {
    // first, make all the cells in the current group visible (might be hidden on collaborator's side)
    const cells = document.querySelectorAll(
      `.cell-version-parallel-${meta.id}`
    );
    cells.forEach(cell => {
      (cell as HTMLElement).style.display = 'block';
    });

    // next, remove the group_id tabs
    const tab_items = document.querySelectorAll(`#version-item-${meta.id}`);
    tab_items.forEach(item => item.parentNode?.removeChild(item));

    // next, make the first new group visible
    const siblingIDs: any[] = [];
    thisTab?.childNodes.forEach(node => {
      if (
        !(node as HTMLElement).classList.contains('selected') &&
        !(node as HTMLElement).classList.contains('version-fork')
      ) {
        const id = (node as HTMLElement).id.split('-')[2];
        if (id !== meta.id) {
          siblingIDs.push(id);
        }
      }
    });

    const siblingCells = document.querySelectorAll(
      `.cell-version-parallel-${siblingIDs[0]}`
    );
    siblingCells.forEach(cell => {
      (cell as HTMLElement).style.display = 'block';
    });
  }

  // remove the decoration on the current cell
  widget.node.className = widget.node.className.replaceAll(
    /cell-version[^ ]*/g,
    ''
  );
  // thisTab?.parentNode?.removeChild(thisTab);
  const tabs = widget.node.querySelectorAll(
    '.cell-version-selection-tab-container'
  );
  tabs.forEach(tab => {
    tab.parentNode?.removeChild(tab);
  });
};
export const renderUnindentBtn = (
  cell: Cell,
  meta: IMetaDataType,
  tracker: INotebookTracker
): void => {
  const indentationNode = document.createElement('div');
  indentationNode.classList.add('indentation-btn');
  cell.node.appendChild(indentationNode);
  const metadata = cell.model.metadata.get('conflict_editing') as any;
  const id = metadata.id;
  const group_id = metadata.parent;
  indentationNode.classList.add('indentation-cancel-btn');
  indentationNode.addEventListener('click', () => {
    // this will unindent the parallel cell group
    // show a dialog for users to confirm
    logger.send(EventType.UnindentCell);
    const tabEle = cell.node.querySelectorAll(
      '.cell-version-selection-tab-item'
    );
    if (tabEle.length > 1) {
      showDialog({
        title: 'Delete Other Parallel Cell Groups',
        body: 'Unindent the current parallel cell group would delete other alternative cell groups. Do you want to continue?',
        buttons: [
          Dialog.cancelButton(),
          Dialog.okButton({
            label: 'GO',
            className: 'TDB-Prompt-Dialog__btn'
          })
        ]
      }).then(res => {
        if (res.button.label === 'GO') {
          unindentParallelGroup(id, group_id, tracker);
          indentationNode.parentNode?.removeChild(indentationNode);
        }
      });
    } else {
      unindentParallelGroup(id, group_id, tracker);
      indentationNode.parentNode?.removeChild(indentationNode);
    }
  });
};
const syncKernel = (tracker: INotebookTracker, id: string) => {
  const kernel = tracker.currentWidget?.sessionContext.session?.kernel;
  if (kernel) {
    const future = kernel?.requestExecute({
      code: `_${id}._sync()`
    });
    future.onIOPub = (msg: any): void => {
      if (msg.msg_type === 'error') {
        console.log(msg);
      }
    };
  }
};
