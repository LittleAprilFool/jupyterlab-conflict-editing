import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';

import { createCurrentTab } from './parallelGroupView';

export const updateVariableHighlights = (
  tracker: INotebookTracker,
  variables: any[]
): void => {
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

export const syncCellDeletion = (metaData: any, tracker: INotebookTracker) => {
  const siblingCells = document.querySelectorAll(
    `.cell-version-parallel-${metaData.id}`
  );

  const siblingTabs = document.querySelectorAll(
    `.cell-version-selection-tab-parent-${metaData.parent}`
  );

  // if this is the last cell in the group
  if (siblingCells.length === 0 && siblingTabs.length > 0) {
    // step one: make the next selected cell group available
    const siblingParent = siblingTabs[0].parentNode as HTMLDivElement;
    const classlists = [...siblingParent.classList];
    const targetClass = classlists.filter(
      str => str.includes('cell-version-parallel') && !str.includes('parent')
    );
    if (targetClass.length > 0) {
      const nextID = targetClass[0].split('-').pop();
      const hiddenCells = document.querySelectorAll(
        `.cell-version-parallel-${nextID}`
      );
      hiddenCells.forEach(cell => {
        (cell as HTMLDivElement).style.display = 'block';
      });
    }

    // step two: remove all the tabs
    const tabElements = document.querySelectorAll(
      `#version-item-${metaData.id}`
    );
    tabElements.forEach(ele => {
      ele.parentNode?.removeChild(ele);
    });
  }

  // if this is the first cell in the group
  const versiongroupTab = document.querySelector(
    `#cell-version-selection-tab-${metaData.id}`
  );

  const otherCells = document.querySelectorAll(
    `.cell-version-parallel-${metaData.id}`
  );
  let selectionTab = document.createElement('div') as any;
  const nextCell = tracker.activeCell;

  console.log('sync deletion');
  console.log(nextCell);

  if (otherCells.length > 0) {
    console.log('need to deal with tabs');
    if (!versiongroupTab) {
      // if (otherCells.length > 0) {
      // search if there are sibling tabs
      const siblingTabs = document.querySelectorAll(
        `.cell-version-selection-tab-parent-${metaData.parent}`
      );

      if (siblingTabs.length > 0) {
        console.log('need to copy from others.');
        selectionTab = siblingTabs[0].cloneNode(true);
        selectionTab.id = `cell-version-selection-tab-${metaData.id}`;
        for (let i = 0; i < selectionTab.childNodes.length; i++) {
          const mirrorNode = siblingTabs[0].childNodes[i] as HTMLDivElement;
          selectionTab.childNodes[i].onclick = mirrorNode.onclick;
        }
        if (nextCell) {
          nextCell.node?.insertBefore(selectionTab, nextCell.node.firstChild);
        }
        selectionTab.querySelector('.selected').classList.remove('selected');
        selectionTab
          .querySelector(`#version-item-${metaData.id}`)
          .classList.add('selected');
        //   }
      } else {
        // if this cell group is the first element in the group, we need to create selectionTabs
        // if this is the first selection tab
        // create a new tab
        selectionTab.id = `cell-version-selection-tab-${metaData.id}`;
        selectionTab.classList.add('cell-version-selection-tab-container');
        selectionTab.classList.add(
          `cell-version-selection-tab-parent-${metaData.parent}`
        );
        if (nextCell && nextCell.model.metadata.has('conflict_editing')) {
          const nextMeta = nextCell?.model.metadata.get('conflict_editing');
          const cells = tracker.currentWidget?.content.widgets as any;
          if (cells) {
            const currentTab = createCurrentTab(
              nextMeta,
              nextCell,
              cells,
              selectionTab
            );
            currentTab.classList.add('selected');
            selectionTab?.appendChild(currentTab);
            nextCell.node?.insertBefore(selectionTab, nextCell.node.firstChild);
          }
        }
      }
    }
  }
};
