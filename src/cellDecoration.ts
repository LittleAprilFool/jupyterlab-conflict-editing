import { generateColor } from './utils';
import { Cell } from '@jupyterlab/cells';
// unfold; fold; side-by-side

export const renderCellDecoration = (
  cell: Cell,
  cells: Cell[],
  renderStyle: string
): void => {
  if (renderStyle === 'fold') {
    renderFold(cell, cells);
  } else {
    renderUnfold(cell);
  }
};

const renderUnfold = (cell: Cell) => {
  if (
    cell.model.metadata.has('conflict_editing') &&
    !cell.hasClass('cell-version')
  ) {
    console.log('render unfold');
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
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    const isFollowing =
      document.querySelector(`.cell-version-parallel-${metaData.id}`) !== null;

    cell.addClass('cell-version');
    cell.addClass(`cell-version-parallel-${metaData.id}`);
    cell.addClass(`cell-version-parallel-parent-${metaData.parent}`);

    if (isFollowing) {
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

    let selectionTab = document.createElement('div') as any;

    // check if there is a parent selection tab
    const parentSelectionTab = document.querySelector(
      `#cell-version-selection-tab-${metaData.parent}`
    );
    if (parentSelectionTab) {
      cell.node.style.display = 'none';
      selectionTab = parentSelectionTab.cloneNode(true);
      for (let i = 0; i < selectionTab.childNodes.length; i++) {
        const mirrorNode = parentSelectionTab.childNodes[i] as HTMLDivElement;
        selectionTab.childNodes[i].onclick = mirrorNode.onclick;
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
    } else {
      // if this is the parent node
      // create a new tab
      selectionTab.id = `cell-version-selection-tab-${metaData.id}`;
      selectionTab.classList.add('cell-version-selection-tab-container');
      selectionTab.classList.add(
        `cell-version-selection-tab-parent-${metaData.parent}`
      );
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

const createCurrentTab = (
  metaData: any,
  cell: Cell,
  cells: Cell[],
  selectionTab: HTMLDivElement
) => {
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

  currentTab.onclick = () => {
    const metaData = cell.model.metadata.get('conflict_editing') as any;
    const siblingCells = document.querySelectorAll(
      `.cell-version-parallel-parent-${metaData.parent}`
    );
    siblingCells.forEach((ele: any): void => {
      ele.style.display = 'none';
    });
    const targetCells = document.querySelectorAll(
      `.cell-version-parallel-${metaData.id}`
    );
    targetCells.forEach(targetCell => {
      const targetCellModel = targetCell as HTMLDivElement;
      targetCellModel.style.display = 'block';
    });
  };
  return currentTab;
};
