import { generateColor } from './utils';
import { Cell } from '@jupyterlab/cells';
// unfold; fold; side-by-side
let renderStyle = 'fold';

export const renderCellDecoration = (cell: Cell, cells: Cell[]) => {
  switch (renderStyle) {
    case 'unfold':
      renderUnfold(cell);
      break;
    case 'fold':
      renderFold(cell, cells);
      break;
    default:
      break;
  }
};

const renderUnfold = (cell: Cell) => {
  if (
    cell.model.metadata.has('conflict_editing') &&
    !cell.hasClass('cell-version')
  ) {
    cell.addClass('cell-version');
    const versionInfoNode = document.createElement('div');
    versionInfoNode.classList.add('version-info-container');

    const versionInfoLabel = document.createElement('div');
    const versionInfoEditor = document.createElement('div');
    const versionInfoEditorInput = document.createElement('input');
    const versionInfoEditorButton = document.createElement('button');
    versionInfoEditor.classList.add('hide');
    versionInfoEditorButton.innerText = 'Save';
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    versionInfoLabel.innerText = metaData.name;
    versionInfoEditorInput.value = metaData.name;
    versionInfoNode.id = `version-item-${metaData.id}`;
    versionInfoNode.innerText = 'version ';
    versionInfoEditor.appendChild(versionInfoEditorInput);
    versionInfoEditor.appendChild(versionInfoEditorButton);
    versionInfoNode.appendChild(versionInfoEditor);
    versionInfoNode.appendChild(versionInfoLabel);
    cell.node.prepend(versionInfoNode);
    versionInfoNode.style.backgroundColor = generateColor(metaData.parent);

    versionInfoLabel.ondblclick = () => {
      versionInfoLabel.classList.toggle('hide');
      versionInfoEditor.classList.toggle('hide');
    };

    versionInfoEditorButton.onclick = () => {
      const name = versionInfoEditorInput.value;
      const newMeta = { ...metaData };
      newMeta.name = name;
      cell.model.metadata.set('conflict_editing', newMeta as any);
      versionInfoLabel.innerText = name;
      versionInfoLabel.classList.toggle('hide');
      versionInfoEditor.classList.toggle('hide');
    };
  }
};

const renderFold = (cell: Cell, cells: Cell[]) => {
  if (
    cell.model.metadata.has('conflict_editing') &&
    !cell.hasClass('cell-version')
  ) {
    cell.addClass('cell-version');
    cell.addClass('cell-version-parallel');
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    let selectionTab = document.querySelector(
      `#cell-version-selection-tab-${metaData.parent}`
    );
    const isFirst = !selectionTab;
    if (isFirst) {
      // if this is the first version, create the selection tab
      selectionTab = document.createElement('div');
      selectionTab.id = `cell-version-selection-tab-${metaData.parent}`;
      selectionTab.classList.add('cell-version-selection-tab-container');
      cell.node?.parentNode?.insertBefore(selectionTab, cell.node);
      cell.node.classList.add('selected');
    }
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
    currentTab.appendChild(versionInfoEditor);
    currentTab.appendChild(versionInfoLabel);
    currentTab.appendChild(mainMark);
    versionInfoLabel.ondblclick = () => {
      versionInfoLabel.classList.toggle('hide');
      versionInfoEditor.classList.toggle('hide');
    };

    mainMark.onclick = () => {
      const metaData = cell.model.metadata.get('conflict_editing') as any;
      if (!mainMark.classList.contains('ismain')) {
        const currentMain = selectionTab?.querySelector('.ismain');
        // currentMain?.classList.toggle('ismain');
        // mainMark.classList.toggle('ismain');

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
        const newMeta = { ...metaData };
        newMeta.ismain = true;
        cell.model.metadata.set('conflict_editing', newMeta as any);
      } else {
        const newMeta = { ...metaData };
        newMeta.ismain = false;
        cell.model.metadata.set('conflict_editing', newMeta as any);
      }
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

    if (isFirst) {
      currentTab.classList.add('selected');
    }
    selectionTab?.appendChild(currentTab);
    cell.node.classList.add(`cell-version-${metaData.id}`);
    cell.node.classList.add(`cell-version-group-${metaData.parent}`);
    currentTab.onclick = () => {
      // close other tabs
      const openCells = document.querySelectorAll(
        `.cell-version-group-${metaData.parent}.selected`
      );
      openCells.forEach(ele => {
        ele.classList.remove('selected');
      });

      const openTabs = selectionTab?.querySelectorAll('.selected');
      openTabs?.forEach(ele => {
        ele.classList.remove('selected');
      });
      // add target cell
      // const targetCell = document.querySelector(
      //   `.cell-version-${metaData.id}`
      // );
      cell.node.classList.add('selected');
      currentTab.classList.add('selected');
    };
  }
  if (
    cell.model.metadata.has('conflict_editing') &&
    cell.hasClass('cell-version')
  ) {
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    const tabComponent = document.querySelector(`#version-item-${metaData.id}`);
    const tabNameEle = tabComponent?.children[1];
    if (tabNameEle && tabNameEle.textContent !== metaData.name) {
      tabNameEle.textContent = metaData.name;
    }

    const mainMark = tabComponent?.querySelector('.mainmark');
    const isContain = mainMark?.classList.contains('ismain');
    if (isContain !== metaData.ismain) {
      mainMark?.classList.toggle('ismain');
    }
  }
};
