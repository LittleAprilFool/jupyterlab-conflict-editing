import { generateColor } from './utils';
import { Cell } from '@jupyterlab/cells';
// unfold; fold; side-by-side
let renderStyle = 'fold';

export const renderCellDecoration = (cell: Cell) => {
  switch (renderStyle) {
    case 'unfold':
      renderUnfold(cell);
      break;
    case 'fold':
      renderFold(cell);
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

const renderFold = (cell: Cell) => {
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
    currentTab.id = `selection-item-${metaData.id}`;

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
    currentTab.appendChild(versionInfoEditor);
    currentTab.appendChild(versionInfoLabel);
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
};
