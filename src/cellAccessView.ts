import { Cell } from '@jupyterlab/cells';
import { getUserList } from '.';
export const renderCellAccessOverview = (cell: Cell): void => {
  const username =
    document.cookie
      .split('; ')
      ?.find(row => row.startsWith('hub_user='))
      ?.split('=')[1] ?? 'unknown';
  if (cell.model.metadata.has('conflict_editing')) {
    return;
  }
  const metaData = cell.model.metadata.get('access_control') as any;

  // display the renderbox
  const staledContainer = cell.node.querySelector('.cellaccess-overview');
  staledContainer?.parentNode?.removeChild(staledContainer);
  const overviewContainer = document.createElement('div');
  overviewContainer.classList.add('cellaccess-overview');
  cell.node.appendChild(overviewContainer);

  const editContainer = document.createElement('div');
  editContainer.classList.add('access-selector-section');
  const editLabel = document.createElement('span');
  editLabel.textContent = 'E: ';
  const editSelector = document.createElement('span');
  const editBlackList = metaData ? metaData.edit ?? [] : [];
  editSelector.classList.add('editselector');
  if (editBlackList.length === 0) {
    editSelector.classList.add('access-selector-everyone');
  } else if (editBlackList.includes(username)) {
    editSelector.classList.add('access-selector-not-me');
  } else {
    editSelector.classList.add('access-selector-some');
  }
  const editLabelSelector = document.createElement('div');
  editLabelSelector.appendChild(editLabel);
  editLabelSelector.appendChild(editSelector);
  editContainer.appendChild(editLabelSelector);
  editLabelSelector.addEventListener('click', () => {
    const staledOption = editContainer.querySelector('.option-container');
    if (staledOption) {
      editContainer.removeChild(staledOption);
    }
    const editOptionPanel = createOptionPanel('edit', editBlackList, cell);
    editContainer.appendChild(editOptionPanel);
  });

  overviewContainer.appendChild(editContainer);

  const readContainer = document.createElement('div');
  readContainer.classList.add('access-selector-section');
  const readLabel = document.createElement('span');
  readLabel.textContent = 'R: ';
  const readSelector = document.createElement('span');
  const readBlackList = metaData ? metaData.read ?? [] : [];
  readSelector.classList.add('writeselector');
  if (readBlackList.length === 0) {
    readSelector.classList.add('access-selector-everyone');
  } else if (readBlackList.includes(username)) {
    readSelector.classList.add('access-selector-not-me');
  } else {
    readSelector.classList.add('access-selector-some');
  }

  const readLabelSelector = document.createElement('div');
  readLabelSelector.appendChild(readLabel);
  readLabelSelector.appendChild(readSelector);
  readContainer.appendChild(readLabelSelector);
  readLabelSelector.addEventListener('click', () => {
    const staledOption = readContainer.querySelector('.option-container');
    if (staledOption) {
      readContainer.removeChild(staledOption);
    }
    const readOptionPanel = createOptionPanel('read', readBlackList, cell);
    readContainer.appendChild(readOptionPanel);
  });

  overviewContainer.appendChild(readContainer);
};

const createOptionPanel = (
  mode: string,
  blacklist: string[],
  cell: Cell
): HTMLDivElement => {
  const userlist = getUserList();
  const optionContainer = document.createElement('div');
  optionContainer.classList.add('option-container');
  const title = document.createElement('div');
  title.textContent = mode === 'edit' ? 'Edit the Cell' : 'Read the Cell';
  const closeBtn = document.createElement('div');
  closeBtn.classList.add('option-close');
  closeBtn.onclick = e => {
    const node = e.target as HTMLElement;
    const container = node.parentNode;
    const parent = container?.parentNode;
    if (container) {
      parent?.removeChild(container);
    }
  };

  const selectAllContainer = document.createElement('div');
  const selectAllText = document.createElement('span');
  selectAllText.textContent = 'Select All';
  selectAllContainer.appendChild(selectAllText);
  const selectAllIcon = document.createElement('span');
  selectAllIcon.innerHTML = `<label class="switch">
    <input type="checkbox">
    <span class="slider round"></span>
  </label>`;
  selectAllContainer.appendChild(selectAllIcon);
  const userListContainer = document.createElement('div');
  userlist.forEach(user => {
    const userOptionWrapper = document.createElement('div');
    const userOptionCheckBox = document.createElement('input');
    userOptionCheckBox.type = 'checkbox';
    userOptionCheckBox.checked = !blacklist.includes(user.name);
    userOptionCheckBox.onclick = () => {
      // change metadata
      const userFlag = userOptionCheckBox.checked;
      if (userFlag) {
        // remove user from blacklist
        blacklist.splice(blacklist.indexOf(user.name), 1);
      } else {
        // add user to blacklist
        blacklist.push(user.name);
      }
      // update metadata
      const oldMeta = cell.model.metadata.get('access_control');
      let access = {
        edit: [] as string[],
        read: [] as string[]
      };
      if (cell) {
        if (oldMeta) {
          access = JSON.parse(JSON.stringify(oldMeta));
        }
        if (mode === 'edit') {
          access.edit = blacklist;
        }
        if (mode === 'read') {
          access.read = blacklist;
        }
      }
      cell?.model.metadata.set('access_control', {});
      cell?.model.metadata.set('access_control', access);
    };
    const userOptionLabel = document.createElement('label');
    userOptionLabel.textContent = user.name;
    userOptionWrapper.appendChild(userOptionCheckBox);
    userOptionWrapper.appendChild(userOptionLabel);
    userListContainer.appendChild(userOptionWrapper);
  });
  optionContainer.appendChild(title);
  optionContainer.appendChild(closeBtn);
  //   optionContainer.appendChild(selectAllContainer);
  optionContainer.appendChild(userListContainer);
  return optionContainer;
};
